use axum::{
	Json,
	extract::{
		Query,
		State
	},
	response::{
		Redirect
	}
};

use serde::{
	Deserialize,
	Serialize
};

use std::{
	sync::{
		Arc
	}
};

use crate::{
	AppState
};

#[derive( Debug, Serialize, Deserialize, Clone )]
pub struct TokenData {
	pub access_token: String,
	pub refresh_token: String,
	pub expires_at: i64
}

#[derive( Deserialize )]
pub struct CallbackParams {
	code: String,
	state: String
}

#[derive( Deserialize )]
struct TokenResponse {
	access_token: String,
	refresh_token: Option<String>,
	expires_in: i64
}


pub async fn get_valid_access_token( state: &Arc<AppState> ) -> Option<String> {
	let now = chrono::Utc::now().timestamp();

	{
		let token = state.token.lock().unwrap();
		if let Some( t ) = token.as_ref() {
			if now < t.expires_at - 60 {
				return Some( t.access_token.clone() );
			}
		} else {
			return None;
		}
	}

	let refresh_token = {
		let token = state.token.lock().unwrap();
		token.as_ref().map( | t | t.refresh_token.clone() )?
	};

	println!( "Access token expired, refreshing..." );

	let form_body = serde_urlencoded::to_string( &[
		( "grant_type", "refresh_token" ),
		( "client_id", state.client_id.as_str() ),
		( "client_secret", state.client_secret.as_str() ),
		( "refresh_token", refresh_token.as_str() ),
	] ).ok()?;

	let response = state.http_client
		.post( "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token" )
		.header( "Content-Type", "application/x-www-form-urlencoded" )
		.body( form_body )
		.send()
		.await
		.ok()?;

	if !response.status().is_success() {
		eprintln!( "Token refresh failed: {}", response.status() );
		// Clear the invalid token so the frontend knows to re-authenticate
		let mut token = state.token.lock().unwrap();
		*token = None;
		return None;
	}

	let token_response = response.json::<TokenResponse>().await.ok()?;
	let new_access_token = token_response.access_token.clone();
	let expires_at = chrono::Utc::now().timestamp() + token_response.expires_in;

	{
		let mut token = state.token.lock().unwrap();
		*token = Some( TokenData {
			access_token: token_response.access_token,
			refresh_token: token_response.refresh_token.unwrap_or( refresh_token ),
			expires_at,
		} );
	}

	println!( "Token refreshed successfully" );
	Some( new_access_token )
}

pub async fn get_auth_url( State( state ): State<Arc<AppState>> ) -> Json<serde_json::Value> {
	let oauth_state = uuid::Uuid::new_v4().to_string();

	{
		let mut pkce = state.pending_pkce.lock().unwrap();
		*pkce = Some( ( oauth_state.clone(), String::new() ) );
	}

	let mut url = reqwest::Url::parse( "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/authorize" ).unwrap();
	url.query_pairs_mut()
		.append_pair( "client_id", &state.client_id )
		.append_pair( "redirect_uri", &state.redirect_uri )
		.append_pair( "response_type", "code" )
		.append_pair( "scope", "openid offline_access vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_location" )
		.append_pair( "state", &oauth_state );

	Json( serde_json::json!( { "url": url.to_string() } ) )
}

pub async fn callback(
	State( app_state ): State<Arc<AppState>>,
	Query( params ): Query<CallbackParams>,
) -> Redirect {
	let code_verifier = {
		let mut pkce = app_state.pending_pkce.lock().unwrap();
		match pkce.as_ref() {
			Some( ( stored_state, _ ) ) if stored_state == &params.state => {
				pkce.take().map( | ( _, v ) | v )
			}
			_ => None,
		}
	};

	let Some( _code_verifier ) = code_verifier else {
		eprintln!( "OAuth callback: invalid or missing state" );
		return Redirect::to( &format!( "{}/?error=invalid_state", app_state.frontend_url ) );
	};

	let form_body = serde_urlencoded::to_string( &[
		( "grant_type", "authorization_code" ),
		( "client_id", app_state.client_id.as_str() ),
		( "client_secret", app_state.client_secret.as_str() ),
		( "code", params.code.as_str() ),
		( "redirect_uri", app_state.redirect_uri.as_str() ),
	] ).unwrap();

	let token_res: Result<reqwest::Response, reqwest::Error> = app_state.http_client
		.post( "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token" )
		.header( "Content-Type", "application/x-www-form-urlencoded" )
		.body( form_body )
		.send()
		.await;

	let response = match token_res {
		Ok( r ) => r,
		Err( e ) => {
			eprintln!( "Token exchange request failed: {}", e );
			return Redirect::to( &format!( "{}/?error=token_request_failed", app_state.frontend_url ) );
		}
	};

	if !response.status().is_success() {
		let status = response.status();
		let body = response.text().await.unwrap_or_default();
		eprintln!( "Token exchange failed ({}): {}", status, body );
		return Redirect::to( &format!( "{}/?error=token_exchange_failed", app_state.frontend_url ) );
	}

	let token_response = match response.json::<TokenResponse>().await {
		Ok( t ) => t,
		Err( e ) => {
			eprintln!( "Failed to parse token response: {}", e );
			return Redirect::to( &format!( "{}/?error=parse_failed", app_state.frontend_url ) );
		}
	};

	let expires_at = chrono::Utc::now().timestamp() + token_response.expires_in;

	{
		let mut token = app_state.token.lock().unwrap();
		*token = Some( TokenData {
			access_token: token_response.access_token,
			refresh_token: token_response.refresh_token.unwrap_or_default(),
			expires_at,
		} );
	}

	println!( "Successfully authenticated with Tesla!" );
	Redirect::to( &app_state.frontend_url )
}

pub async fn logout( State( state ): State<Arc<AppState>> ) -> Json<serde_json::Value> {
	let token_data = {
		let mut token = state.token.lock().unwrap();
		token.take()
	};

	let Some( token_data ) = token_data else {
		return Json( serde_json::json!( { "message": "not logged in" } ) );
	};

	for token in [ &token_data.access_token, &token_data.refresh_token ] {
		if token.is_empty() { continue; }

		let form_body = serde_urlencoded::to_string( &[
			( "token", token.as_str() ),
			( "client_id", state.client_id.as_str() ),
			( "client_secret", state.client_secret.as_str() ),
		] ).unwrap_or_default();

		if let Err( e ) = state.http_client
			.post( "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/revoke" )
			.header( "Content-Type", "application/x-www-form-urlencoded" )
			.body( form_body )
			.send()
			.await
		{
			eprintln!( "Token revocation request failed: {}", e );
		}
	}

	Json( serde_json::json!( { "message": "logged out" } ) )
}

pub async fn status( State( state ): State<Arc<AppState>> ) -> Json<serde_json::Value> {
	let token = state.token.lock().unwrap();
	let authenticated = token.is_some();
	let expires_at = token.as_ref().map( | t | t.expires_at );
	Json( serde_json::json!( {
		"authenticated": authenticated,
		"expires_at": expires_at,
	} ) )
}
