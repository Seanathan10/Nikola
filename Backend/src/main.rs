mod db;
mod auth;
mod proto;
mod tesla;
mod signed_cmd;

use crate::{
	db::{
		initialize_database
	}
};

use tokio::{
	net::{
		TcpListener
	}
};

use p256::{
	ecdsa::{
		SigningKey
	},
	pkcs8::{
		DecodePrivateKey
	},
	SecretKey
};

use axum::{
	Json,
	Router,
	http::{
		Method,
		HeaderValue,
		StatusCode,
		header
	},
	routing::{
		get,
		post
	},
	middleware::{
		from_fn_with_state,
		Next
	},
	extract::{
		State,
		Request
	},
	response::{
		Response,
		IntoResponse
	},
	body::{
		Body
	},
};

use serde_json::{
	Value,
	json
};

use tower_http::{
	cors::{
		CorsLayer
	}
};

use tower_cookies::{
	CookieManagerLayer
};

use std::{
	collections::{
		HashMap
	},
	sync::{
		Arc,
		Mutex
	},
	fs::{
		read_to_string
	},
	env::{
		var
	}
};

use sqlx::{
	SqlitePool
};

pub struct CachedSession {
	pub epoch: Vec<u8>,
	pub counter: u32,
	pub clock_time: u32,                                         // car clock value at the moment of fetch
	pub fetched_at: std::time::Instant,                          // server time of the fetch, to compute elapsed
	pub vehicle_public_key: Vec<u8>,
}

pub struct AppState {
	pub http_client: reqwest::Client,

	pub client_id: String,
	pub client_secret: String,
	pub redirect_uri: String,
	pub fleet_api_base: String,
	pub frontend_url: String,

	pub cookie_secure: bool,

	pub database: SqlitePool,

	pub signing_key: SigningKey,
	pub public_key_bytes: Vec<u8>,                                 // uncompressed 65 byte SEC1
	pub secret_key_bytes: [u8; 32],                                // raw P-256 scalar, used for ECDH per-command

	pub sessions: Mutex<HashMap<(String, i32), CachedSession>>,    // keyed by VIN, Domain
}

async fn health_check( State( _state ): State<Arc<AppState>> ) -> Json<Value> {
	return Json( json!( { "message": "app backend works" } ) )
}


async fn csrf_origin_guard(
	State( state ): State<Arc<AppState>>,
	request: Request,
	next: Next,
) -> Response {
	if request.method() == Method::POST {
		let allowed = state.frontend_url.trim_end_matches( '/' );

		let origin_ok = request.headers()
			.get( header::ORIGIN )
			.and_then( | v | v.to_str().ok() )
			.map( | o | o.trim_end_matches( '/' ) == allowed )
			.unwrap_or( false );

		if !origin_ok {
			return ( StatusCode::FORBIDDEN, Json( json!( { "error": "bad_origin" } ) ) ).into_response();
		}
	}

	next.run( request ).await
}

async fn public_key() -> Response<Body> {
	let key = read_to_string( "./Keys/public-key.pem" ).unwrap_or_default();

	return Response::builder()
		.header( header::CONTENT_TYPE, "application/x-pem-file" )
		.body( Body::from( key ) )
		.unwrap()
}

fn load_p256_key( pem: &str ) -> Result<SecretKey, String> {
	if let Ok( k ) = SecretKey::from_sec1_pem( pem ) {
		return Ok( k );
	}

	if let Ok( k ) = SecretKey::from_pkcs8_pem( pem ) {
		return Ok( k );
	}


	let b64: String = pem.lines()
		.skip_while( |l| !l.starts_with( "-----BEGIN" ) )
		.skip( 1 )
		.take_while( |l| !l.starts_with( "-----END" ) )
		.collect();


	use base64::Engine as _;
	let der = base64::engine::general_purpose::STANDARD
		.decode( b64.as_str() )
		.map_err( |e| format!( "base64 decode error: {}", e ) )?;

	// SEC1 ECPrivateKey DER: SEQUENCE { INTEGER(1), OCTET STRING(32 bytes = scalar), ... }
	// scan for first `0x04 0x20` which is the 32-byte private scalar
	for i in 0..der.len().saturating_sub( 33 ) {
		if der[i] == 0x04 && der[i + 1] == 0x20 {
			let scalar_bytes: &[u8; 32] = der[i + 2..i + 34]
				.try_into()
				.map_err( |_| "slice length mismatch".to_string() )?;

			return SecretKey::from_bytes( scalar_bytes.into() ).map_err( |e| format!( "invalid scalar: {}", e ) );
		}
	}

	return Err( "could not find 32-byte private scalar in SEC1 DER — is this a P-256 key?".to_string() )
}

#[tokio::main]
async fn main() {
	println!( "[main.rs] begin main file" );
	dotenvy::dotenv().ok();

	let client_id = var( "TESLA_CLIENT_ID" ).expect( "TESLA_CLIENT_ID not set" );
	let client_secret = var( "TESLA_CLIENT_SECRET" ).expect( "TESLA_CLIENT_SECRET not set" );

	let redirect_uri = var( "REDIRECT_URI" )
		.unwrap_or_else( |_| "http://localhost:3001/api/auth/callback".to_string() );

	let fleet_api_base = var( "FLEET_API_BASE" )
		.unwrap_or_else( |_| "https://fleet-api.prd.na.vn.cloud.tesla.com".to_string() );

	let frontend_url = var( "FRONTEND_URL" )
		.unwrap_or_else( |_| "http://localhost:5173".to_string() );

	let cookie_secure = var( "COOKIE_SECURE" )
		.map( | v | !matches!( v.trim().to_ascii_lowercase().as_str(), "false" | "0" | "no" ) )
		.unwrap_or( true );

	let dev_login_enabled =
		matches!(
			var( "DEV_LOGIN" )
				.unwrap_or_default()
				.trim()
				.to_ascii_lowercase()
				.as_str(),

			"1"
		);

	let bind_addr = var( "BIND_ADDR" ).unwrap_or_else( |_| "127.0.0.1:3001".to_string() );

	#[cfg( not( debug_assertions ) )]
	{
		if dev_login_enabled {
			panic!( "dev login enabled in release. exiting." );
		}
		if !cookie_secure {
			panic!( "cookie security disabled in release. exiting." );
		}
	}

	let private_key = read_to_string( "./Keys/private-key.pem" ).expect( "private key not found" );

	let private_key = private_key.replace( "\r\n", "\n" ).replace( "\r", "\n" );

	let secret_key = load_p256_key( &private_key ).expect( "Failed to load private key." );
	let signing_key = SigningKey::from( &secret_key );

	let public_key_bytes = secret_key.public_key().to_sec1_bytes().to_vec();
	let secret_key_bytes: [ u8; 32 ] = secret_key.to_bytes().into();

	let database = initialize_database().await;

	let state = Arc::new( AppState {
		http_client: reqwest::Client::new(),
		client_id: client_id,
		client_secret: client_secret,
		redirect_uri: redirect_uri,
		fleet_api_base: fleet_api_base,
		frontend_url: frontend_url.clone(),
		cookie_secure: cookie_secure,
		database: database,
		signing_key: signing_key,
		public_key_bytes: public_key_bytes,
		secret_key_bytes: secret_key_bytes,
		sessions: Mutex::new( HashMap::new() ),
	} );


	let cors_origin = frontend_url.trim_end_matches( '/' );

	let cors_config = CorsLayer::new()
		.allow_methods( [ Method::GET, Method::POST ] )
		.allow_origin( cors_origin.parse::<HeaderValue>().unwrap() )
		.allow_headers( [ header::CONTENT_TYPE ] )
		.allow_credentials( true );

	#[allow( unused_mut )]
	let mut app = Router::new()
		.route( "/.well-known/appspecific/com.tesla.3p.public-key.pem", get( public_key ) )

		.route( "/",                        get( health_check ) )
		.route( "/api/auth/url",            get( auth::get_auth_url ) )
		.route( "/api/auth/callback",       get( auth::callback ) )
		.route( "/api/auth/logout",         get( auth::logout ) )
		.route( "/api/auth/status",         get( auth::status ) )
		.route( "/api/charging/history",    get( tesla::charging_history ) )
		.route( "/api/pairing/status",      get( tesla::pairing_status ) )
		.route( "/api/vehicle/state",       get( tesla::vehicle_state ) )
		.route( "/api/vehicle/online",      get( tesla::vehicle_online ) )

		.route( "/api/pairing/confirm",     post( tesla::pairing_confirm ) )
		.route( "/api/wake",                post( tesla::wake ) )
		.route( "/api/trunk",               post( tesla::trunk ) )
		.route( "/api/flash",               post( tesla::flash ) )
		.route( "/api/charge_port",         post( tesla::charge_port ) )
		.route( "/api/charge_port_latch",   post( tesla::charge_port_latch ) );


	#[cfg( debug_assertions )]
	{
		if dev_login_enabled {
			app = app.route( "/api/dev/login", post( auth::dev_login ) );
		}
	}

	let app = app
		.layer( from_fn_with_state( state.clone(), csrf_origin_guard ) )
		.layer( cors_config )
		.layer( CookieManagerLayer::new() )
		.with_state( state );

	let listener = TcpListener::bind( &bind_addr ).await.unwrap();
	println!( "Server started on {}", bind_addr );
	axum::serve( listener, app ).await.unwrap();
}
