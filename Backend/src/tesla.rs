use crate::{
	AppState,

	signed_cmd::{
		DOMAIN_VCSEC,
		DOMAIN_INFOTAINMENT,
		send_signed_command
	},

	auth::{
		get_valid_access_token,
		CurrentUser
	},

	proto::{
		car_server::{
			self,
			ChargePortDoorClose,
			ChargePortDoorOpen,
			VehicleAction,
			VehicleControlFlashLightsAction,
			vehicle_action::{
				VehicleActionMsg
			},
			action::{
				ActionMsg
			}
		},
		vcsec::{
			ClosureMoveRequest,
			ClosureMoveTypeE,
			UnsignedMessage,
			unsigned_message::{
				SubMessage
			}
		}
	}
};

use axum::{
	extract::{
		State
	},
	Json
};

use prost::{
	Message
};

use serde_json::{
	json,
	Value
};

use std::{
	sync::{
		Arc
	},
	time::{
		Duration
	}
};


const VEHICLE_DATA_ENDPOINTS: &str = "drive_state%3Bcharge_state%3Bclimate_state%3Bvehicle_state%3Blocation_data";


pub enum VehicleDataError {
	Asleep,
	Unreachable( String ),
}


impl VehicleDataError {
	fn public_msg( &self ) -> &'static str {
		match self {
			VehicleDataError::Asleep => "vehicle_asleep",
			VehicleDataError::Unreachable( _ ) => "vehicle_unreachable",
		}
	}

	fn log( &self, context: &str ) {
		if let VehicleDataError::Unreachable( detail ) = self {
			eprintln!( "[{}] vehicle unreachable: {}", context, detail );
		}
	}
}


async fn resolve_vin( state: &Arc<AppState>, access_token: &str ) -> Result<String, String> {
	let url = format!( "{}/api/1/vehicles", state.fleet_api_base );
	let body: Value = state.http_client
		.get( &url )
		.bearer_auth( access_token )
		.send()
		.await
		.map_err( |e| format!( "vehicles request failed: {}", e ) )?
		.json()
		.await
		.map_err( |e| format!( "vehicles parse error: {}", e ) )?;

	let vin = body[ "response" ][ 0 ][ "vin" ]
		.as_str()
		.ok_or_else( || "VIN not found in vehicles response".to_string() )?
		.to_string();

	return Ok( vin )
}


async fn fleet_status_paired( state: &Arc<AppState>, access_token: &str, vin: &str ) -> Result<bool, String> {
	let url = format!( "{}/api/1/vehicles/fleet_status", state.fleet_api_base );
	let body: Value = state.http_client
		.post( &url )
		.bearer_auth( access_token )
		.json( &json!( { "vins": [ vin ] } ) )
		.send()
		.await
		.map_err( |e| format!( "fleet_status request failed: {}", e ) )?
		.json()
		.await
		.map_err( |e| format!( "fleet_status parse error: {}", e ) )?;

	let paired = body[ "response" ][ "key_paired_vins" ]
		.as_array()
		.map( |a| a.iter().any( |v| v.as_str() == Some( vin ) ) )
		.unwrap_or( false );

	return Ok( paired )
}




fn map_vehicle_response( d: &Value ) -> Value {
	let range_mi = d[ "charge_state" ][ "battery_range" ].as_f64();
	let range_km = range_mi.map( |mi| ( mi * 1.60934 * 10.0 ).round() / 10.0 );

	// shift_state is "D"/"R"/"N"/"P" or null when parked with controller off.
	let drive_state = match d[ "drive_state" ][ "shift_state" ].as_str() {
		Some( "D" ) => "driving",
		Some( "R" ) => "reversing",
		Some( "N" ) => "neutral",
		_           => "parked", // "P" or null
	};

	// use GPS coordinates for location since active_route_destination is only populated during active navigation
	let location = match (
		d[ "drive_state" ][ "latitude" ].as_f64(),
		d[ "drive_state" ][ "longitude" ].as_f64(),
	) {
		( Some( lat ), Some( lon ) ) => format!( "{:.4}, {:.4}", lat, lon ),
		_ => String::new(),
	};

	json!( {
		"status":                    "awake",
		"displayName":               d[ "display_name" ],
		"driveState":                drive_state,
		"batteryPercent":            d[ "charge_state" ][ "battery_level" ],
		"batteryRangeMi":            range_mi,
		"batteryRangeKM":            range_km,
		"chargingState":             d[ "charge_state" ][ "charging_state" ],
		"locationName":              location,
		"locked":                    d[ "vehicle_state" ][ "locked" ],
		"climateOn":                 d[ "climate_state" ][ "is_climate_on" ],
		"chargePortDoor":            d[ "charge_state" ][ "charge_port_door_open" ],
		"chargeEnergyAdded":         d[ "charge_state" ][ "charge_energy_added" ],
		"minutesToFullCharge":       d[ "charge_state" ][ "minutes_to_full_charge" ],
		"chargerPowerKw":            d[ "charge_state" ][ "charger_power" ],
		"chargerVoltage":            d[ "charge_state" ][ "charger_voltage" ],
		"chargerActualCurrent":      d[ "charge_state" ][ "charger_actual_current" ],
		"chargeRateMph":             d[ "charge_state" ][ "charge_rate" ],
		"chargeLimitSoc":            d[ "charge_state" ][ "charge_limit_soc" ],
		"chargeLimitSocMax":         d[ "charge_state" ][ "charge_limit_soc_max" ],
		"chargeLimitSocMin":         d[ "charge_state" ][ "charge_limit_soc_min" ],
		"chargeLimitSocStd":         d[ "charge_state" ][ "charge_limit_soc_std" ],
		"chargeMilesAddedRated":     d[ "charge_state" ][ "charge_miles_added_rated" ],
		"chargerPhases":             d[ "charge_state" ][ "charger_phases" ],
		"chargerPilotCurrent":       d[ "charge_state" ][ "charger_pilot_current" ],
		"chargeCurrentRequest":      d[ "charge_state" ][ "charge_current_request" ],
		"chargeCurrentRequestMax":   d[ "charge_state" ][ "charge_current_request_max" ],
		"chargePortLatch":           d[ "charge_state" ][ "charge_port_latch" ],
		"chargePortColor":           d[ "charge_state" ][ "charge_port_color" ],
		"connChargeCable":           d[ "charge_state" ][ "conn_charge_cable" ],
		"fastChargerPresent":        d[ "charge_state" ][ "fast_charger_present" ],
		"fastChargerType":           d[ "charge_state" ][ "fast_charger_type" ],
		"fastChargerBrand":          d[ "charge_state" ][ "fast_charger_brand" ],
		"scheduledChargingMode":     d[ "charge_state" ][ "scheduled_charging_mode" ],
		"scheduledChargingPending":  d[ "charge_state" ][ "scheduled_charging_pending" ],
		"scheduledChargingStartTime":d[ "charge_state" ][ "scheduled_charging_start_time" ],
		"offPeakChargingEnabled":    d[ "charge_state" ][ "off_peak_charging_enabled" ],
		"usableBatteryLevel":        d[ "charge_state" ][ "usable_battery_level" ],
		"batteryHeaterOn":           d[ "charge_state" ][ "battery_heater_on" ],
		"idealBatteryRange":         d[ "charge_state" ][ "ideal_battery_range" ],
		"estBatteryRange":           d[ "charge_state" ][ "est_battery_range" ],
		"notEnoughPowerToHeat":      d[ "charge_state" ][ "not_enough_power_to_heat" ]
	} )
}


async fn fetch_vehicle_data( state: &Arc<AppState>, access_token: &str ) -> Result<Value, VehicleDataError> {
	let vin = resolve_vin( state, access_token ).await
		.map_err( VehicleDataError::Unreachable )?;

	let url = format!(
		"{}/api/1/vehicles/{}/vehicle_data?endpoints={}",
		state.fleet_api_base, vin, VEHICLE_DATA_ENDPOINTS
	);

	let response = state.http_client
		.get( &url )
		.bearer_auth( access_token )
		.send()
		.await
		.map_err( |e| VehicleDataError::Unreachable( format!( "vehicle_data request failed: {}", e ) ) )?;

	let http_status = response.status();

	let res: Value = response
		.json()
		.await
		.map_err( |e| VehicleDataError::Unreachable( format!( "vehicle_data parse error: {}", e ) ) )?;

	if let Some( err ) = res[ "error" ].as_str() {
		if http_status.as_u16() == 408 || err.contains( "offline or asleep" ) || err.contains( "vehicle unavailable" ) {
			return Err( VehicleDataError::Asleep );
		}

		return Err( VehicleDataError::Unreachable( err.to_string() ) );
	}

	Ok( map_vehicle_response( &res[ "response" ] ) )
}




pub async fn pairing_status( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "status": "unpaired", "error": "not_authenticated" } ) );
	};

	let vin = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( _ ) => return Json( json!( { "status": "unpaired" } ) ),
	};

	let paired = fleet_status_paired( &state, &access_token, &vin ).await.unwrap_or( false );
	Json( json!( { "status": if paired { "paired" } else { "unpaired" } } ) )
}






pub async fn wake( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "ok": false, "error": "not_authenticated" } ) );
	};

	let vin = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!( { "ok": false, "error": e } ) ),
	};

	let wake_url = format!( "{}/api/1/vehicles/{}/wake_up", state.fleet_api_base, vin );
	let _ = state.http_client
		.post( &wake_url )
		.bearer_auth( &access_token )
		.send()
		.await;

	Json( json!( { "ok": true } ) )
}


pub async fn vehicle_online( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "error": "not_authenticated" } ) );
	};

	let vin = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!( { "error": e } ) ),
	};

	let url = format!( "{}/api/1/vehicles/{}", state.fleet_api_base, vin );
	let result = state.http_client
		.get( &url )
		.bearer_auth( &access_token )
		.send()
		.await;

	match result {
		Ok( r ) => match r.json::<Value>().await {
			Ok( body ) => {
				let car_state = body[ "response" ][ "state" ].as_str().unwrap_or( "unknown" ).to_string();
				Json( json!( { "online": car_state == "online", "state": car_state } ) )
			},
			Err( e ) => Json( json!( { "error": format!( "parse error: {}", e ) } ) ),
		},
		Err( e ) => Json( json!( { "error": format!( "request failed: {}", e ) } ) ),
	}
}


pub async fn pairing_confirm( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "verified": false, "error": "not_authenticated" } ) );
	};

	let vin = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!( { "verified": false, "error": e } ) )
	};

	let poll_url = format!( "{}/api/1/vehicles/{}", state.fleet_api_base, vin );
	let mut online = false;

	for _ in 0..10 {
		tokio::time::sleep( Duration::from_millis( 3000 ) ).await;
		if let Ok( r ) = state.http_client.get( &poll_url ).bearer_auth( &access_token ).send().await {
			if let Ok( body ) = r.json::<Value>().await {
				if body[ "response" ][ "state" ].as_str() == Some( "online" ) {
					online = true;
					break;
				}
			}
		}
	}

	if !online {
		return Json( json!( {
			"verified": false,
			"error": "car_asleep",
			"message": "Car is not online. Open the Tesla app to wake it, then try again."
		} ) );
	}

	// Ask Tesla whether the virtual key is actually paired (authoritative).
	match fleet_status_paired( &state, &access_token, &vin ).await {
		Ok( true )  => Json( json!( { "verified": true } ) ),
		Ok( false ) => Json( json!( {
			"verified": false,
			"error": "key_not_paired",
			"message": "Car is online but the virtual key isn't paired yet. Approve it in the Tesla app, then try again."
		} ) ),
		Err( e ) => Json( json!( {
			"verified": false,
			"error": "fleet_status_failed",
			"message": e
		} ) ),
	}
}



pub async fn trunk( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "error": "not_authenticated" } ) );
	};

	let vin = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!( { "error": e } ) ),
	};


	let vcsec_msg = UnsignedMessage {
		sub_message: Some( SubMessage::ClosureMoveRequest( ClosureMoveRequest {
			rear_trunk: ClosureMoveTypeE::ClosureMoveTypeMove as i32,
			..Default::default()
		} ) ),
	};
	let plaintext = vcsec_msg.encode_to_vec();

	match send_signed_command( &state, &access_token, &vin, DOMAIN_VCSEC, plaintext ).await {
		Ok( () ) => Json( json!( { "ok": true } ) ),
		Err( e ) => Json( json!( { "ok": false, "error": e } ) )
	}
}

pub async fn charge_port( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!(
			{
				"error": "not authenticated"
			}
		) );
	};

	let vin = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!(
			{
				"error": e
			}
		) )
	};

	// Read the current door state so we know whether to open or close it.
	let vehicle = match fetch_vehicle_data( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => {
			e.log( "charge_port" );
			return Json( json!( { "ok": false, "error": e.public_msg() } ) );
		}
	};
	let currently_open = vehicle[ "chargePortDoor" ].as_bool().unwrap_or( false );

	let vcsec_msg = if currently_open {
		car_server::Action {
			action_msg: Some( ActionMsg::VehicleAction( VehicleAction {
				vehicle_action_msg: Some( VehicleActionMsg::ChargePortDoorClose( ChargePortDoorClose {} ) )
			} ) )
		}
	} else {
		car_server::Action {
			action_msg: Some( ActionMsg::VehicleAction( VehicleAction {
				vehicle_action_msg: Some( VehicleActionMsg::ChargePortDoorOpen( ChargePortDoorOpen {} ) )
			} ) )
		}
	};

	let plaintext = vcsec_msg.encode_to_vec();

	match send_signed_command( &state, &access_token, &vin, DOMAIN_INFOTAINMENT, plaintext ).await {
		Ok( () ) => Json( json!( { "ok": true } ) ),
		Err( e ) => Json( json!( { "ok": false, "error": e } ) )
	}
}


pub async fn charge_port_latch( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!(
			{
				"error": "not authenticated"
			}
		) );
	};

	let VIN = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!(
			{
				"error": e
			}
		) )
	};

	let VCSEC_msg = UnsignedMessage {
		sub_message: Some( SubMessage::ClosureMoveRequest( ClosureMoveRequest {
		 charge_port: ClosureMoveTypeE::ClosureMoveTypeMove as i32,
			..Default::default()
		} 	 ) 	 ),
	};

	let plaintext = VCSEC_msg.encode_to_vec();

	match send_signed_command(&state, &access_token, &VIN, DOMAIN_VCSEC, plaintext).await{
		Ok( () ) => Json( json!( { "ok": true } ) ),
		Err( E ) => Json( json!( { "ok": false, "error": E } ) )
	}
}


pub async fn flash( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!(
			{
				"error": "not authenticated"
			}
		) );
	};

	let VIN = match resolve_vin( &state, &access_token ).await {
		Ok( v ) => v,
		Err( e ) => return Json( json!(
			{
				"error": e
			}
		) )
	};

	// let VCSEC_msg = UnsignedMessage {
	// 	sub_message: Some( SubMessage::ClosureMoveRequest( ClosureMoveRequest {
	// 	 charge_port: ClosureMoveTypeE::ClosureMoveTypeMove as i32,
	// 		..Default::default()
	// 	} 	 ) 	 ),
	// };


	// action_msg: VehicleAction {
	// 	vehicle_action_msg: VehicleControlFlashLightsAction {}
	// }


	let VCSEC_msg = car_server::Action {
		action_msg: Some( ActionMsg::VehicleAction( VehicleAction {
			vehicle_action_msg: Some( VehicleActionMsg::VehicleControlFlashLightsAction(
				VehicleControlFlashLightsAction {  }
			) )
		} ) )
	};

	let plaintext = VCSEC_msg.encode_to_vec();

	match send_signed_command(&state, &access_token, &VIN, DOMAIN_INFOTAINMENT, plaintext).await{
		Ok( () ) => Json( json!( { "ok": true } ) ),
		Err( E ) => Json( json!( { "ok": false, "error": E } ) )
	}
}


pub async fn vehicle_state( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "error": "not_authenticated" } ) );
	};

	match fetch_vehicle_data( &state, &access_token ).await {
		Ok( vehicle ) => Json( vehicle ), // carries "status": "awake"
		Err( VehicleDataError::Asleep ) => Json( json!( { "status": "asleep" } ) ),
		Err( e ) => {
			e.log( "vehicle_state" );
			Json( json!( { "status": "unreachable" } ) )
		},
	}
}


pub async fn charging_history( State( state ): State<Arc<AppState>>, CurrentUser( user_id ): CurrentUser ) -> Json<Value> {
	let Some( access_token ) = get_valid_access_token( &state, user_id ).await else {
		return Json( json!( { "error": "not_authenticated" } ) );
	};

	let url = format!( "{}/api/1/dx/charging/history", state.fleet_api_base );

	let response = state.http_client
		.get( &url )
		.bearer_auth( &access_token )
		.send()
		.await;

	match response {
		Ok( res ) => {
			let status = res.status();
			match res.json::<Value>().await {
				Ok( data ) => {
					if !status.is_success() {
						eprintln!( "Charging history API error ({}): {:?}", status, data );
					}
					Json( data )
				}
				Err( e ) => Json( json!( { "error": format!( "parse error: {}", e ) } ) ),
			}
		},
		Err( e ) => Json( json!( { "error": format!( "request failed: {}", e ) } ) ),
	}
}
