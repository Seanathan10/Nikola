import type { VehicleState } from "../types";
import "../css/VehicleStatus.css";

type Props = {
	vehicle: VehicleState | null;
	loading: boolean;
	wakeStatus: string;
};

const DASH = "—";

function fmt( value: number | string | null | undefined, suffix = "" ): string {
	return value != null ? `${ value }${ suffix }` : `${ DASH }${ suffix }`;
}

export default function VehicleStatus( { vehicle, loading, wakeStatus }: Props ) {
	const v = vehicle;

	const driveLabel = v
		? { parked: "Parked", driving: "Driving", reversing: "Reversing", neutral: "Neutral" }[ v.driveState ] ?? v.driveState
		: DASH;

	const lockedLabel = v
		? ( v.locked == null ? DASH : v.locked ? "Yes" : "No" )
		: DASH;

	const climateLabel = v
		? ( v.climateOn == null ? DASH : v.climateOn ? "On" : "Off" )
		: DASH;

	return (
		<section className="vehicle-status">
			<h2>Vehicle Status{ v?.displayName ? ` — ${ v.displayName }` : "" }</h2>
			{ loading && <p>Loading...</p> }
			<table>
				<tbody>
					<tr>
						<td>Connection</td>
						<td>{ wakeStatus === "waking" ? "Waking…" : wakeStatus }</td>
					</tr>
					<tr>
						<td>Status</td>
						<td>{ driveLabel }</td>
					</tr>
					<tr>
						<td>Battery</td>
						<td>{ fmt( v?.batteryPercent, "%" ) }</td>
					</tr>
					<tr>
						<td>Range</td>
						<td>{ fmt( v?.batteryRangeMi, " mi" ) } / { fmt( v?.batteryRangeKM, " km" ) }</td>
					</tr>
					<tr>
						<td>Charging</td>
						<td>{ fmt( v?.chargingState ) }</td>
					</tr>
					<tr>
						<td>Location</td>
						<td>{ fmt( v?.locationName ) }</td>
					</tr>
					<tr>
						<td>Locked</td>
						<td>{ lockedLabel }</td>
					</tr>
					<tr>
						<td>Climate</td>
						<td>{ climateLabel }</td>
					</tr>
				</tbody>
			</table>
		</section>
	);
}
