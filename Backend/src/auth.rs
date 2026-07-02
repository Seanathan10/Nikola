use axum::{
	Json,
	extract::{
		Query,
		State,
		FromRequestParts
	},
	http::{
		StatusCode,
		request::{
			Parts
		}
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
	AppState,
	db::{
		get_access_token,
		get_session,
		store_pkce_state,
		store_session,
		store_tokens,
		delete_session,
		delete_tokens,
		upsert_user
	}
};

#[cfg( debug_assertions )]
use crate::{
	db::{
		get_latest_user_id
	}
};

use sqlx::{
	prelude::{
		FromRow
	}
};

use tower_cookies::{
	Cookies,
	Cookie,
	cookie::{
		SameSite,
		time::{
			Duration as CookieDuration
		}
	}
};

use chrono::{
	Utc
};


pub fn sha256_hex( input: &str ) -> String {
	use sha2::{ Digest, Sha256 };
	Sha256::digest( input.as_bytes() )
		.iter()
		.map( | b | format!( "{:02x}", b ) )
		.collect()
}




fn build_session_cookie( raw_session: String, secure: bool ) -> Cookie<'static> {
	let mut cookie = Cookie::new( "session", raw_session );

	cookie.set_http_only( true );
	cookie.set_path( "/" );
	cookie.set_max_age( CookieDuration::days( 30 ) );

	cookie.set_same_site( SameSite::Lax );
	cookie.set_secure( secure );

	return cookie;
}


fn decode_jwt_payload( token: &str ) -> Option<serde_json::Value> {
	use base64::Engine as _;
	let payload_b64 = token.split( '.' ).nth( 1 )?;
	let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode( payload_b64 ).ok()?;
	serde_json::from_slice( &bytes ).ok()
}


pub struct CurrentUser( pub i64 );


impl FromRequestParts<Arc<AppState>> for CurrentUser {
	type Rejection = ( StatusCode, Json<serde_json::Value> );

	async fn from_request_parts( parts: &mut Parts, state: &Arc<AppState> ) -> Result<Self, Self::Rejection> {
		let unauthorized = || (
			StatusCode::UNAUTHORIZED,
			Json( serde_json::json!( { "error": "not_authenticated" } ) )
		);

		let cookies = Cookies::from_request_parts( parts, state ).await
			.map_err( | _ | unauthorized() )?;

		let raw = cookies.get( "session" )
			.map( | c | c.value().to_string() )
			.ok_or_else( unauthorized )?;

		let user_id = get_session( &state.database, &sha256_hex( &raw ) ).await
			.ok_or_else( unauthorized )?;

		Ok( CurrentUser( user_id ) )
	}
}

#[derive( Debug, Serialize, Deserialize, Clone, FromRow )]
pub struct TokenData {
	pub access_token: String,
	pub refresh_token: String,
	pub expires_at: i64
}

#[derive( Debug, Serialize, Deserialize, Clone, FromRow )]
pub struct PkceData {
	pub state: String,
	pub verifier: String,
	pub created_at: i64
}

#[derive( Deserialize )]
pub struct CallbackParams {
	code: String,
	state: String
}

#[derive( Debug, Serialize, Deserialize, Clone, FromRow )]
pub struct SessionData {
	id: String,
	user_id: i64,
	created_at: i64,
	expires_at: i64
}


#[derive( Deserialize )]
struct TokenResponse {
	access_token: String,
	refresh_token: Option<String>,
	expires_in: i64,
	scope: Option<String>,
	id_token: Option<String>
}

pub async fn get_valid_access_token( state: &Arc<AppState>, user_id: i64 ) -> Option<String> {
	let now = Utc::now().timestamp();

	let token = get_access_token( &state.database, user_id ).await?;

	if now < token.expires_at - 60 {
		return Some( token.access_token );
	}

	println!( "Access token expired, refreshing..." );

	let form_body = serde_urlencoded::to_string( &[
		( "grant_type", "refresh_token" ),
		( "client_id", state.client_id.as_str() ),
		( "client_secret", state.client_secret.as_str() ),
		( "refresh_token", token.refresh_token.as_str() ),
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
		return None;
	}

	let token_response = response.json::<TokenResponse>().await.ok()?;
	let new_access_token = token_response.access_token.clone();
	let new_expires_at = now + token_response.expires_in;
	let new_refresh = token_response.refresh_token.unwrap_or( token.refresh_token );

	if let Err( e ) = store_tokens( &state.database, user_id, &new_access_token, &new_refresh, new_expires_at ).await {
		eprintln!( "Failed to persist refreshed token: {}", e );
	}

	println!( "Token refreshed successfully" );
	Some( new_access_token )
}

pub async fn get_auth_url( State( state ): State<Arc<AppState>> ) -> Json<serde_json::Value> {
	let oauth_state = uuid::Uuid::new_v4().to_string();

	store_pkce_state( &state.database, oauth_state.clone(), String::new() ).await;

	let mut url = reqwest::Url::parse( "https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/authorize" ).unwrap();
	url.query_pairs_mut()
		.append_pair( "client_id", &state.client_id )
		.append_pair( "redirect_uri", &state.redirect_uri )
		.append_pair( "response_type", "code" )
		.append_pair( "scope", "openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_location" )
		.append_pair( "state", &oauth_state );

	Json( serde_json::json!( { "url": url.to_string() } ) )
}



pub async fn callback(
	State( app_state ): State<Arc<AppState>>,
	cookies: Cookies,
	Query( params ): Query<CallbackParams>,
) -> Redirect {
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

	eprintln!(
		"[callback] token exchange ok — granted scope: {:?}, id_token present: {}",
		token_response.scope, token_response.id_token.is_some()
	);

	let expires_at = Utc::now().timestamp() + token_response.expires_in;
	let access_token = token_response.access_token;
	let refresh_token = token_response.refresh_token.unwrap_or_default();


	let Some( id_token ) = token_response.id_token.as_deref() else {
		eprintln!( "[callback] token response had no id_token" );
		return Redirect::to( &format!( "{}/?error=identity_failed", app_state.frontend_url ) );
	};

	let Some( claims ) = decode_jwt_payload( id_token ) else {
		eprintln!( "[callback] failed to decode id_token payload" );
		return Redirect::to( &format!( "{}/?error=identity_failed", app_state.frontend_url ) );
	};

	eprintln!( "[callback] id_token claims: {}", claims );

	let account_id = claims[ "sub" ].as_str().unwrap_or_default().to_string();
	let email      = claims[ "email" ].as_str();

	if account_id.is_empty() {
		eprintln!( "[callback] id_token missing `sub` claim" );
		return Redirect::to( &format!( "{}/?error=identity_failed", app_state.frontend_url ) );
	}

	let user_id = upsert_user(
		&app_state.database,
		&account_id,
		email
	).await;

	// let store_success = store_tokens(
	// 	&app_state.database,
	// 	user_id,
	// 	&access_token,
	// 	&refresh_token,
	// 	expires_at
	// ).await;

	if let Err( e ) = store_tokens(
		&app_state.database,
		user_id,
		&access_token,
		&refresh_token,
		expires_at
	).await {
		eprintln!( "Failed to store tokens: {}", e );
		return Redirect::to( &format!( "{}/?error=store_failed", app_state.frontend_url ) );
	}

	let raw_session = uuid::Uuid::new_v4().simple().to_string()
		+ &uuid::Uuid::new_v4().simple().to_string();
	let session_expires_at = Utc::now().timestamp() + 60 * 60 * 24 * 30; // 30 days

	if let Err( e ) = store_session(
		&app_state.database,
		&sha256_hex( &raw_session ),
		user_id,
		session_expires_at
	).await {
		eprintln!( "Failed to store session: {}", e );
		return Redirect::to( &format!( "{}/?error=session_failed", app_state.frontend_url ) );
	}

	cookies.add( build_session_cookie( raw_session, app_state.cookie_secure ) );

	println!( "Successfully authenticated Tesla account {}", account_id );
	Redirect::to( &app_state.frontend_url )
}


pub async fn logout( State( state ): State<Arc<AppState>>, cookies: Cookies ) -> Json<serde_json::Value> {
	let Some( raw ) = cookies.get( "session" ).map( | c | c.value().to_string() ) else {
		return Json( serde_json::json!( { "message": "not logged in" } ) );
	};
	let hash = sha256_hex( &raw );

	let Some( user_id ) = get_session( &state.database, &hash ).await else {
		return Json( serde_json::json!( { "message": "not logged in" } ) );
	};


	if let Some( token_data ) = get_access_token( &state.database, user_id ).await {
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
	}

	let _ = delete_session( &state.database, &hash ).await;
	let _ = delete_tokens( &state.database, user_id ).await;

	let mut removal = Cookie::new( "session", "" );
	removal.set_path( "/" );
	cookies.remove( removal );

	Json( serde_json::json!( { "message": "logged out" } ) )
}

pub async fn status( State( state ): State<Arc<AppState>>, cookies: Cookies ) -> Json<serde_json::Value> {
	let user_id = match cookies.get( "session" ) {
		Some( c ) => get_session( &state.database, &sha256_hex( c.value() ) ).await,
		None      => None,
	};

	let Some( user_id ) = user_id else {
		return Json( serde_json::json!( { "authenticated": false, "expires_at": serde_json::Value::Null } ) );
	};

	match get_access_token( &state.database, user_id ).await {
		Some( token ) => Json( serde_json::json!( {
			"authenticated": true,
			"expires_at": token.expires_at,
		} ) ),
		None => Json( serde_json::json!( { "authenticated": false, "expires_at": serde_json::Value::Null } ) ),
	}
}


#[cfg( debug_assertions )]
#[derive( Deserialize )]
pub struct DevLoginParams {
	user_id: Option<i64>,
}

#[cfg( debug_assertions )]
pub async fn dev_login(
	State( state ): State<Arc<AppState>>,
	cookies: Cookies,
	Query( params ): Query<DevLoginParams>,
) -> ( StatusCode, Json<serde_json::Value> ) {
	let user_id = match params.user_id {
		Some( id ) => id,
		None => match get_latest_user_id( &state.database ).await {
			Some( id ) => id,
			None => return (
				StatusCode::BAD_REQUEST,
				Json( serde_json::json!( {
					"error": "no_users",
					"message": "use tunnel to perform 1 real authentication to begin using the dev network"
				} ) )
			),
		},
	};

	let raw_session = uuid::Uuid::new_v4().simple().to_string()
		+ &uuid::Uuid::new_v4().simple().to_string();
	let session_expires_at = Utc::now().timestamp() + 60 * 60 * 24 * 30; // 30 days

	if let Err( e ) = store_session(
		&state.database,
		&sha256_hex( &raw_session ),
		user_id,
		session_expires_at
	).await {
		eprintln!( "[auth.rs] failed to store session: {}", e );
		return (
			StatusCode::INTERNAL_SERVER_ERROR,
			Json( serde_json::json!( { "error": "session_failed" } ) )
		);
	}

	cookies.add( build_session_cookie( raw_session, state.cookie_secure ) );


	let tesla_tokens = get_access_token( &state.database, user_id ).await.is_some();

	println!( "[auth.rs] loaded for user_id={} (tesla_tokens={})", user_id, tesla_tokens );

	return (
		StatusCode::OK,
		Json( serde_json::json!( {
			"authenticated": true,
			"user_id": user_id,
			"has_tesla_tokens": tesla_tokens,
		} ) )
	)
}
