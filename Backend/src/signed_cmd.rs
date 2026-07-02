use crate::{
	AppState,
	CachedSession,
	proto::{
		universal_message::{
			Destination,
			SessionInfoRequest as UniversalSessionInfoRequest,
			MessageFaultE,
			MessageFaultE::{
				MessagefaultErrorNone,
				MessagefaultErrorIncorrectEpoch,
				MessagefaultErrorInvalidTokenOrCounter,
			},
			destination::{
				SubDestination::{
					Domain as SubDomain,
					RoutingAddress
				}
			},
			RoutableMessage,
			routable_message::{
				Payload::{
					SessionInfo as PayloadSessionInfo,
					SessionInfoRequest as PayloadSessionInfoRequest,
					ProtobufMessageAsBytes as PayloadProtoMsgAsBytes
				},
				SubSigData::{
					SignatureData as SubSignatureData
				}
			}
		},
		signatures::{
			KeyIdentity,
			SessionInfo as SessionInfoSignature,
			SignatureData,
			HmacPersonalizedSignatureData,
			key_identity::{
				IdentityType::{
					PublicKey as PublicKeyIdentityType
				}
			},
			signature_data::{
				SigType::{
					HmacPersonalizedData
				}
			}
		}
	}
};

use std::{
	sync::{
		Arc
	}
};

use prost::{
	Message
};

use rand::{
	RngCore,
	thread_rng
};

use hmac::{
	Mac,
	Hmac,
};

use sha1::{
	Sha1,
	Digest::{
		self
	}
};

use sha2::{
	Sha256
};

use p256::{
	SecretKey,
	PublicKey,
	ecdh::{
		diffie_hellman
	}
};

use base64::{
	Engine::{
		self
	},
	engine::{
		general_purpose::{
			STANDARD as base64_engine
		}
	}
};

type HmacSha256 = Hmac<Sha256>;


// these are the domains used in the metadata struct
// each domain makes the metadata package correct for only its region of control
// VCSEC controls major functions like locks/trunk/frunk/charging
// while infotainment is more harmless, screen-only controls
pub const DOMAIN_VCSEC: i32 = 2;
pub const DOMAIN_INFOTAINMENT: i32 = 3;
const FLAGS_ENCRYPT_RESPONSE: u32 = 2;


// this ius what gets POSTed to `/signed_command`
// this is what the tesla api expects and returns:
// expect:  { "routable_message": "<base64 encoded serialized RoutableMessage>" }
// return:  { "response": "<base64 encoded serialized RoutableMessage>" }
async fn post_routable_message(
	state: &Arc<AppState>,
	access_token: &str,
	vin: &str,
	msg_bytes: Vec<u8>,
) -> Result<RoutableMessage, String> {
	let b64 = base64_engine.encode( &msg_bytes );

	let body = serde_json::json!( { "routable_message": b64 } );
	let url = format!( "{}/api/1/vehicles/{}/signed_command", state.fleet_api_base, vin );

	let res = state.http_client
		.post( &url )
		.bearer_auth( access_token )
		.json( &body )
		.send()
		.await
		.map_err( |e| format!( "signed_command POST failed: {}", e ) )?;

	let status = res.status();

	let res_as_bytes = res.bytes()
		.await
		.map_err( |e| format!( "signed_command read body failed: {}", e ) )?;

	eprintln!( "[signed_command log] HTTP {} - response: {}", status, String::from_utf8_lossy( &res_as_bytes[..res_as_bytes.len().min( 300 ) ] ) );

	let json: serde_json::Value = serde_json::from_slice( &res_as_bytes )
		.map_err( |_| format!( "response is not JSON: {}", String::from_utf8_lossy( &res_as_bytes[..res_as_bytes.len().min( 200 ) ] ) ) )?;

	if let Some( err ) = json["error"].as_str() {
		let desc = json["error_description"].as_str().unwrap_or( "" );
		return Err( if desc.is_empty() {
			format!( "Tesla API error: {}", err )
		} else {
			format!( "Tesla API error: {} — {}", err, desc )
		} );
	}

	let b64_resp = json[ "response" ].as_str().ok_or_else( || format!( "response JSON has no 'response' field: {}", json ) )?;

	let proto_bytes = base64_engine.decode( b64_resp ).map_err( |e| format!( "base64 decode failed: {}", e ) )?;

	RoutableMessage::decode( proto_bytes.as_ref() ).map_err( |e| format!( "RoutableMessage decode failed: {}", e ) )
}



pub async fn fetch_session_info(
	state: &Arc<AppState>,
	access_token: &str,
	vin: &str,
	domain: i32,
) -> Result<(), String> {
	let mut routing_addr = vec![ 0u8; 16 ];
	thread_rng().fill_bytes( &mut routing_addr );

	let mut uuid = vec![ 0u8; 16 ];
	thread_rng().fill_bytes( &mut uuid );

	let msg = RoutableMessage {
		to_destination: Some( Destination {
			sub_destination: Some( SubDomain( domain ) ),
		} ),

		from_destination: Some( Destination {
			sub_destination: Some( RoutingAddress( routing_addr ) ),
		} ),

		payload: Some( PayloadSessionInfoRequest( UniversalSessionInfoRequest {
			public_key: state.public_key_bytes.clone(),
			..Default::default()
		} ) ),

		uuid,

		..Default::default()
	};

	let routable = post_routable_message( state, access_token, vin, msg.encode_to_vec() ).await?;

	if let Some( ref status ) = routable.signed_message_status {
		if status.signed_message_fault != MessagefaultErrorNone as i32 {
			let fault = MessageFaultE::try_from( status.signed_message_fault )
				.map( |f| format!( "{:?}", f ) )
				.unwrap_or_else( |_| format!( "fault {}", status.signed_message_fault ) );
			return Err( format!( "session info request rejected by vehicle: {}", fault ) );
		}
	}

	let session_info_bytes = match routable.payload {
		Some( PayloadSessionInfo( b ) ) => b,
		other => return Err( format!(
			"session info response had unexpected payload: {:?}",
			other.map( |_| "other_variant" ),
		) ),
	};

	let info = SessionInfoSignature::decode( session_info_bytes.as_ref() )
		.map_err( |e| format!( "SessionInfo decode failed: {}", e ) )?;

	if info.status != 0 {
		return Err( format!( "key not on vehicle whitelist (status {})", info.status ) );
	}

	eprintln!(
		"[session] domain={} counter={} clock_time={} pub_key_len={}",
		          domain, info.counter, info.clock_time, info.public_key.len()
	);

	state.sessions.lock().unwrap().insert( ( vin.to_string(), domain ), CachedSession {
		epoch: info.epoch,
		counter: info.counter,
		clock_time: info.clock_time,
		fetched_at: std::time::Instant::now(),
		vehicle_public_key: info.public_key,
	} );

	return Ok( () )
}


// Shared ECDH secret X-coordinate → SHA-1 → first 16 bytes = AES-128 key.
fn derive_aes_key( secret_bytes: &[u8; 32], vehicle_pub_bytes: &[u8] ) -> Result<[u8; 16], String> {
	let sk = SecretKey::from_bytes( secret_bytes.into() ).map_err( |e| format!( "bad secret key: {}", e ) )?;
	let pk = PublicKey::from_sec1_bytes( vehicle_pub_bytes ).map_err( |e| format!( "bad vehicle public key: {}", e ) )?;

	let shared = diffie_hellman( sk.to_nonzero_scalar(), pk.as_affine() );
	let digest = Sha1::digest( shared.raw_secret_bytes().as_slice() );

	let mut key = [0u8; 16];
	key.copy_from_slice( &digest[..16] );
	return Ok( key )
}


// K' = HMAC-SHA256( aes_key, "authenticated command" )
// tag = HMAC-SHA256( K', TLV_fields_in_tag_order || 0xFF || plaintext_bytes )
fn compute_hmac_tag(
	aes_key: &[u8; 16],
	domain: i32,
	vin: &str,
	epoch: &[u8],
	expires_at: u32,
	counter: u32,
	flags: u32,
	plaintext: &[u8],
) -> Vec<u8> {
	let mut kdf = HmacSha256::new_from_slice( aes_key ).expect( "invalid hmac key length" );
	kdf.update( b"authenticated command" );

	let kprime = kdf.finalize().into_bytes();
	let mut tlv = HmacSha256::new_from_slice( &kprime ).expect( "invalid hmac key length" );

	// TLV fields in order
	tlv.update( &[0x00, 0x01, 0x08] );                        // TAG_SIGNATURE_TYPE=0, HMAC_PERSONALIZED=8
	tlv.update( &[0x01, 0x01, domain as u8] );                // TAG_DOMAIN=1

	let vin_bytes = vin.as_bytes();
	tlv.update( &[0x02, vin_bytes.len() as u8] );             // TAG_PERSONALIZATION=2
	tlv.update( vin_bytes );

	tlv.update( &[0x03, epoch.len() as u8] );                 // TAG_EPOCH=3
	tlv.update( epoch );

	tlv.update( &[0x04, 0x04] );                              // TAG_EXPIRES_AT=4
	tlv.update( &expires_at.to_be_bytes() );

	tlv.update( &[0x05, 0x04] );                              // TAG_COUNTER=5
	tlv.update( &counter.to_be_bytes() );

	if flags > 0 {
		tlv.update( &[0x07, 0x04] );                          // TAG_FLAGS=7 (only if set)
		tlv.update( &flags.to_be_bytes() );
	}

	tlv.update( &[0xFF] );                                    // TAG_END
	tlv.update( plaintext );

	return tlv.finalize().into_bytes().to_vec();              // encode correctly
}


pub async fn send_signed_command(
	state: &Arc<AppState>,
	access_token: &str,
	vin: &str,
	domain: i32,
	plaintext: Vec<u8>,
) -> Result<(), String> {
	{
		let has_session = state.sessions.lock().unwrap().contains_key( &( vin.to_string(), domain ) );
		if !has_session {
			fetch_session_info( state, access_token, vin, domain ).await?;
		}
	}

	for attempt in 0..2u8 {
		let response = try_send( state, access_token, vin, domain, &plaintext ).await?;

		let fault = response.signed_message_status
			.as_ref()
			.map( |s| s.signed_message_fault )
			.unwrap_or( 0 );

		if fault == MessagefaultErrorNone as i32 {
			return Ok( () );
		}

		let is_desync = fault == MessagefaultErrorIncorrectEpoch as i32
			|| fault == MessagefaultErrorInvalidTokenOrCounter as i32;

		if attempt == 0 && is_desync {
			eprintln!( "[signed_cmd] session desync (fault {}) — refetching session", fault );
			fetch_session_info( state, access_token, vin, domain ).await?;
			continue;
		}

		let fault_name = MessageFaultE::try_from( fault )
			.map( |f| format!( "{:?}", f ) )
			.unwrap_or_else( |_| format!( "unknown fault {}", fault ) );

		return Err( format!( "vehicle rejected command: {}", fault_name ) );
	}

	return Err( "signed command failed after session resync".to_string() )
}

async fn try_send(
	state: &Arc<AppState>,
	access_token: &str,
	vin: &str,
	domain: i32,
	plaintext: &[u8],
) -> Result<RoutableMessage, String> {
	// increment counter and cache the session state while under lock
	let (epoch, counter, expires_at, vehicle_pub_key) = {
		let mut sessions = state.sessions.lock().map_err( |e| format!( "failed to lock sessions: {e}" ) )?;

		let session = sessions.get_mut( &( vin.to_string(), domain ) ).ok_or_else( || format!( "no session for domain {}", domain ) )?;

		//                     4294967295
		if session.counter == 0xFFFF_FFFF {
			return Err( "counter rollover; session exhausted".to_string() );
		}

		session.counter += 1;

		let elapsed_secs = session.fetched_at.elapsed().as_secs() as u32;
		let car_clock_now = session.clock_time.saturating_add( elapsed_secs );
		let expires_at = car_clock_now + 10;

		(
			session.epoch.clone(),
			session.counter,
			expires_at,
			session.vehicle_public_key.clone(),
		)
	};

	let aes_key = derive_aes_key( &state.secret_key_bytes, &vehicle_pub_key )?;
	let tag = compute_hmac_tag( &aes_key, domain, vin, &epoch, expires_at, counter, FLAGS_ENCRYPT_RESPONSE, plaintext );

	let mut routing_addr = vec![ 0u8; 16 ];
	thread_rng().fill_bytes( &mut routing_addr );

	let mut uuid = vec![ 0u8; 16 ];
	thread_rng().fill_bytes( &mut uuid );

	let msg = RoutableMessage {
		to_destination: Some( Destination {
			sub_destination: Some( SubDomain( domain ) ),
		} ),

		from_destination: Some( Destination {
			sub_destination: Some( RoutingAddress( routing_addr ) ),
		} ),

		flags: FLAGS_ENCRYPT_RESPONSE,

		payload: Some( PayloadProtoMsgAsBytes( plaintext.to_vec() ) ),

		sub_sig_data: Some(
			SubSignatureData(
				SignatureData {
					signer_identity: Some(
						KeyIdentity {
							identity_type: Some( PublicKeyIdentityType( state.public_key_bytes.clone() ) ),
						}
					),

					sig_type: Some(
						HmacPersonalizedData(
							HmacPersonalizedSignatureData {
								epoch: epoch.clone(),
								counter,
								expires_at,
								tag,
							}
						)
					),
				}
			)
		),

		uuid,

		..Default::default()
	};

	eprintln!( "[signed_cmd] sending domain={} counter={} expires_at={}", domain, counter, expires_at );

	return post_routable_message( state, access_token, vin, msg.encode_to_vec() ).await
}
