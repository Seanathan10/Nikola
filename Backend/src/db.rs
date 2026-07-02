use std::{
	process::{
		exit
	},
	str::{
		FromStr
	}
};

use sqlx::{
	Error as SqlxError,
	query,
	query_as,
	query_scalar,
	migrate,
	Pool,
	Sqlite,
	SqlitePool,
	sqlite::{
		SqliteConnectOptions,
		SqlitePoolOptions,
		SqliteJournalMode::{
			Wal
		},
	},
};

use crate::{
	auth::{
		TokenData,
		PkceData
	}
};

use chrono::{
	Utc
};

pub async fn initialize_database() -> SqlitePool {
	let options: SqliteConnectOptions = SqliteConnectOptions::from_str( "sqlite:tesla.db" )
		.expect( "DB creation failed. Cannot proceed." )
		.create_if_missing( true )
		.journal_mode( Wal )
		.read_only( false );

	let sqlite_pool: Pool<Sqlite> = match SqlitePoolOptions::new()
		.max_connections( 5 )
		.connect_with( options )
		.await {
			Ok( db ) => db,
			Err( error ) => {
				eprintln!( "Failed to connect to DB, error {}", error );
				exit( 1 );
			}
		};

	// according to the docs, this is relative to Cargo.toml
	match migrate!( "./migrations" ).run( &sqlite_pool ).await {
		Ok( _ ) => {
			println!( "Migrations succeeded" );
		},
		Err( error ) => {
			eprintln!( "Migrations failed. Error: {}", error  );
		}
	}

	return sqlite_pool;
}

fn get_current_time() -> i64 {
	return Utc::now().timestamp();
}

pub async fn store_tokens(
	pool: &SqlitePool,
	user_id: i64,
	access_token: &str,
	refresh_token: &str,
	expires_at: i64
) -> Result<(), SqlxError> {
	query( "INSERT INTO oauth_tokens (user_id, access_token, refresh_token, expires_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			access_token = excluded.access_token,
			refresh_token = excluded.refresh_token,
			expires_at = excluded.expires_at"
	)
	.bind( user_id )
	.bind( access_token )
	.bind( refresh_token )
	.bind( expires_at )
	.execute( pool )
	.await?;

	return Ok( () );
}

pub async fn get_access_token(
	pool: &SqlitePool,        // get the current pool as input
	user_id: i64              // and current user
) -> Option<TokenData> {      // return the access token, refresh token and expiry time
	return query_as::<Sqlite, TokenData>( "SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?" )
		.bind( user_id )
		.fetch_optional( pool )
		.await
		.expect( "get_access_token critical error" )
}



pub async fn store_session(
	pool: &SqlitePool,
	id: &str,
	user_id: i64,
	expires_at: i64
) -> Result<(), SqlxError> {
	query( "INSERT INTO sessions(id, user_id, created_at, expires_at) VALUES(?, ?, ?, ?)" )
		.bind( id )
		.bind( user_id )
		.bind( get_current_time() )
		.bind( expires_at )
		.execute( pool )
		.await?;

	Ok( () )
}

pub async fn get_session(
	pool: &SqlitePool,
	session_id: &str
) -> Option<i64> {
	query_scalar::<_, i64>("SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?" )
        .bind( session_id )
        .bind( get_current_time() )
        .fetch_optional( pool )
        .await
        .expect( "get_session_user error" )
}


pub async fn delete_session(
	pool: &SqlitePool,
	id: &str
) -> Result<(), SqlxError> {
	query( "DELETE FROM sessions WHERE id = ?" )
		.bind( id )
		.execute( pool )
		.await?;

	return Ok( () );
}

pub async fn delete_tokens(
	pool: &SqlitePool,
	user_id: i64
) -> Result<(), SqlxError> {
	query( "DELETE FROM oauth_tokens WHERE user_id = ?" )
		.bind( user_id )
		.execute( pool )
		.await?;

	return Ok( () );
}

pub async fn store_pkce_state(
	pool: &SqlitePool,
	state: String,
	verifier: String
) -> Result<(), ()> {
	query( "INSERT INTO pending_oauth(state, code_verifier, created_at) VALUES(?, ?, ?)" )
		.bind( state )
		.bind( verifier )
		.bind( get_current_time() )
		.execute( pool )
		.await;

	return Ok( () )
}

pub async fn get_pkce_state(
	pool: &SqlitePool,
	state: &str
) -> Option<PkceData> {
	return query_as::<Sqlite, PkceData>( "SELECT * FROM pending_oauth WHERE state = ?" )
		.bind( state )
		.fetch_optional( pool )
		.await
		.expect( "get_pkce_state error" );
}


pub async fn upsert_user(
	pool: &SqlitePool,
	tesla_account_id: &str,
	email: Option<&str>
) -> i64 {
    sqlx::query(
        "INSERT INTO users (tesla_account_id, email, created_at) VALUES (?, ?, ?)
         ON CONFLICT(tesla_account_id) DO UPDATE SET email = excluded.email",
    )
    .bind( tesla_account_id )
    .bind( email )
    .bind( get_current_time() )
    .execute(pool)
    .await
    .expect( "upsert_user" );

    sqlx::query_scalar::<_, i64>("SELECT id FROM users WHERE tesla_account_id = ?")
        .bind( tesla_account_id )
        .fetch_one( pool )
        .await
        .expect("select user id")
}
