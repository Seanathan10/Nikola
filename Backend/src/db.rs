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
	migrate,
	Pool::{
		self
	},
	Sqlite::{
		self
	},
	SqlitePool::{
		self
	},
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
		TokenData
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
	refresh_token: String,
	access_token: String,
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
	query_as::<Sqlite, TokenData>( "SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE user_id = ?" )
		.bind( user_id )
		.fetch_optional( pool )
		.await
		.expect( "get_access_token critical error" )
}
