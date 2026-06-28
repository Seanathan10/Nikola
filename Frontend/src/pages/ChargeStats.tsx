import type { VehicleState } from "../types";
import "../css/ChargeStats.css";

type Props = { vehicle: VehicleState | null };

const DASH = "—";

function v(value: string | number | boolean | null | undefined, suffix = "", decimals?: number): string {
	if ( value == null ) return DASH;
	if ( typeof value === "boolean" ) return value ? "Yes" : "No";
	if ( typeof value === "number" && decimals != null ) return `${ value.toFixed( decimals ) }${ suffix }`;
	if ( value === "<invalid>" ) return "---";
	return `${ value }${ suffix }`;
}

function fmtTime( minutes: number | null | undefined ): string {
	if ( minutes == null ) return DASH;
	if ( minutes === 0 ) return "Full";
	const h = Math.floor( minutes / 60 );
	const m = minutes % 60;
	if ( h === 0 ) return `${ m } min`;
	return m === 0 ? `${ h } hr` : `${ h } hr ${ m } min`;
}

function fmtUnixTime( ts: number | null | undefined ): string {
	if ( ts == null ) return DASH;
	return new Date( ts * 1000 ).toLocaleTimeString( [], { hour: "2-digit", minute: "2-digit" } );
}

export default function ChargeStats( { vehicle: s }: Props ) {
	const charging = s?.chargingState === "Charging";

	const stats: [ string, string ][] = [
		[ "Status",          v( s?.chargingState ) ],
		[ "Charge Limit",    v( s?.chargeLimitSoc, "%" ) ],
		[ "Limit (Std)",     v( s?.chargeLimitSocStd, "%" ) ],
		[ "Limit (Max)",     v( s?.chargeLimitSocMax, "%" ) ],
		[ "Limit (Min)",     v( s?.chargeLimitSocMin, "%" ) ],
		[ "Energy Added",    v( s?.chargeEnergyAdded, " kWh", 2 ) ],
		[ "Miles Added",     v( s?.chargeMilesAddedRated, " mi", 1 ) ],
		[ "Time to Full",    fmtTime( s?.minutesToFullCharge ) ],
		[ "Power",           charging ? v( s?.chargerPowerKw, " kW" ) : DASH ],
		[ "Current",         charging ? v( s?.chargerActualCurrent, " A" ) : DASH ],
		[ "Voltage",         charging ? v( s?.chargerVoltage, " V" ) : DASH ],
		[ "Charge Rate",     charging ? v( s?.chargeRateMph, " mph" ) : DASH ],
		[ "Phases",          charging ? v( s?.chargerPhases ) : DASH ],
		[ "Pilot Current",   v( s?.chargerPilotCurrent, " A" ) ],
		[ "Requested",       v( s?.chargeCurrentRequest, " A" ) ],
		[ "Max Accepted",    v( s?.chargeCurrentRequestMax, " A" ) ],
		[ "Cable",           v( s?.connChargeCable ) ],
		[ "Port Latch",      v( s?.chargePortLatch ) ],
		[ "Port Color",      v( s?.chargePortColor ) ],
		[ "Fast Charger",    v( s?.fastChargerPresent ) ],
		[ "Charger Type",    v( s?.fastChargerType ) ],
		[ "Charger Brand",   v( s?.fastChargerBrand ) ],
		[ "Usable Level",    v( s?.usableBatteryLevel, "%" ) ],
		[ "Heater On",       v( s?.batteryHeaterOn ) ],
		[ "Not Enough Pwr",  v( s?.notEnoughPowerToHeat ) ],
		[ "Est Range",       v( s?.estBatteryRange, " mi", 1 ) ],
		[ "Ideal Range",     v( s?.idealBatteryRange, " mi", 1 ) ],
		[ "Sched Mode",      v( s?.scheduledChargingMode ) ],
		[ "Sched Pending",   v( s?.scheduledChargingPending ) ],
		[ "Sched Start",     fmtUnixTime( s?.scheduledChargingStartTime ) ],
		[ "Off-Peak",        v( s?.offPeakChargingEnabled ) ],
	];

	return (
		<section className="charge-stats-section">
			<h2>Charge Stats</h2>

			<div className="charge-stats-grid">
				{ stats.map( ( [ label, value ] ) => (
					<div className="charge-stat" key={ label }>
						<span className="charge-stat-label">{ label }</span>
						<span className="charge-stat-value">{ value }</span>
					</div>
				) ) }
			</div>
		</section>
	);
}
