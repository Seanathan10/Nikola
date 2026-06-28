import type {
	ChargeSession,
	ChargeFee
} from "../types";

import "../css/ChargeHistory.css";

type Props = {
	sessions: ChargeSession[] | null;
	loading: boolean;
	onFetch: () => void;
};

function getChargingFee( fees: ChargeFee[] ): ChargeFee | undefined {
	return fees.find( f => f.feeType === "CHARGING" );
}

function formatDuration( start: string, stop: string ): string {
	const ms = new Date( stop ).getTime() - new Date( start ).getTime();
	const mins = Math.round( ms / 60000 );
	const h = Math.floor( mins / 60 );
	const m = mins % 60;
	return h > 0 ? `${ h }h ${ m }m` : `${ m }m`;
}

function formatDate( iso: string ): string {
	return new Date( iso ).toLocaleString( undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	} );
}

export default function ChargeHistory( { sessions, loading, onFetch }: Props ) {
	const totalCost = sessions
		?.reduce( ( sum, s ) => sum + ( getChargingFee( s.fees )?.totalDue ?? 0 ), 0 )
		.toFixed( 2 );

	const totalKwh = sessions
		?.reduce( ( sum, s ) => sum + ( getChargingFee( s.fees )?.usageBase ?? 0 ), 0 )
		.toFixed( 2 );

	return (
		<section className="charge-history">
			<div className="section-header">
				<h2>Charging History</h2>
				<button onClick={ onFetch }>{ sessions ? "Refresh" : "Load" }</button>
			</div>

			{ loading && <p>Loading...</p> }

			{ sessions && (
				<>
					<div className="history-summary">
						<span>{ sessions.length } sessions</span>
						<span>{ totalKwh } kWh total</span>
						<span>${ totalCost } total spent</span>
					</div>

					<div className="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Start</th>
								<th>End</th>
								<th>Location</th>
								<th>Duration</th>
								<th>Energy (kWh)</th>
								<th>Rate ($/kWh)</th>
								<th>Cost</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{ sessions.map( session => {
								const fee = getChargingFee( session.fees );
								return (
									<tr key={ session.sessionId }>
										<td>{ formatDate( session.chargeStartDateTime ) }</td>
										<td>{ formatDate( session.chargeStopDateTime ) }</td>
										<td>{ session.siteLocationName }</td>
										<td>{ formatDuration( session.chargeStartDateTime, session.chargeStopDateTime ) }</td>
										<td>{ fee?.usageBase.toFixed( 2 ) ?? "—" }</td>
										<td>{ fee ? `$${ fee.rateBase.toFixed( 3 ) }` : "—" }</td>
										<td>{ fee ? `$${ fee.totalDue.toFixed( 2 ) }` : "—" }</td>
										<td>{ fee?.status ?? "—" }</td>
									</tr>
								);
							} ) }
						</tbody>
					</table>
					</div>
				</>
			) }
		</section>
	);
}
