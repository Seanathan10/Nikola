import { useState } from "react";

import type { VehicleState, PairingCheck } from "../types";
import "../css/VehicleStatus.css";

const PAIRING_URL = "https://tesla.com/_ak/nikola.byseansingh.com";

type Props = {
	vehicle: VehicleState | null;
	loading: boolean;
	wakeStatus: string;
	asleep: boolean;
	pairing: PairingCheck | null;
	pairingVerifying: boolean;
	onVerifyPairing: () => void;
	onConfirmPairing: () => void;
};

const DASH = "—";

function fmt(value: number | string | null | undefined, suffix = ""): string {
	return value != null ? `${value}${suffix}` : `${DASH}${suffix}`;
}

export default function VehicleStatus({
	vehicle,
	loading,
	wakeStatus,
	asleep,
	pairing,
	pairingVerifying,
	onVerifyPairing,
	onConfirmPairing,
}: Props) {
	const v = vehicle;
	const [flowOpen, setFlowOpen] = useState(false);

	const driveLabel = v
		? ({
				parked: "Parked",
				driving: "Driving",
				reversing: "Reversing",
				neutral: "Neutral",
			}[v.driveState] ?? v.driveState)
		: DASH;

	const lockedLabel = v
		? v.locked == null
			? DASH
			: v.locked
				? "Yes"
				: "No"
		: DASH;

	const climateLabel = v
		? v.climateOn == null
			? DASH
			: v.climateOn
				? "On"
				: "Off"
		: DASH;

	// sleep/wake state now lives in the Connection row instead of a floating status line
	const connectionLabel = asleep
		? "Asleep"
		: wakeStatus.startsWith("waking")
			? wakeStatus.replace(/^waking/, "Waking…")
			: v
				? "Online"
				: wakeStatus;

	const paired = pairing && !pairing.error && pairing.status === "paired";
	const pairingUnknown = !pairing || pairing.error;

	return (
		<section className="vehicle-status">
			<h2>Vehicle Status{v?.displayName ? ` — ${v.displayName}` : ""}</h2>
			{loading && <p>Loading...</p>}
			<table>
				<tbody>
					<tr>
						<td>Virtual Key</td>
						<td>
							<span className="vk-cell">
								{pairingVerifying && !pairing ? (
									"Checking…"
								) : pairingUnknown ? (
									<>
										unknown
										<button
											onClick={onVerifyPairing}
											disabled={pairingVerifying}
										>
											Check
										</button>
									</>
								) : paired ? (
									"Paired"
								) : (
									<>
										Not paired
										<button
											onClick={() =>
												setFlowOpen((o) => !o)
											}
										>
											{flowOpen ? "Hide" : "Pair"}
										</button>
									</>
								)}
							</span>
						</td>
					</tr>
					<tr>
						<td>Connection</td>
						<td>{connectionLabel}</td>
					</tr>
					<tr>
						<td>Status</td>
						<td>{driveLabel}</td>
					</tr>
					<tr>
						<td>Battery</td>
						<td>{fmt(v?.batteryPercent, "%")}</td>
					</tr>
					<tr>
						<td>Range</td>
						<td>
							{fmt(v?.batteryRangeMi, " mi")} /{" "}
							{fmt(v?.batteryRangeKM, " km")}
						</td>
					</tr>
					<tr>
						<td>Charging</td>
						<td>{fmt(v?.chargingState)}</td>
					</tr>
					<tr>
						<td>Location</td>
						<td>{fmt(v?.locationName)}</td>
					</tr>
					<tr>
						<td>Locked</td>
						<td>{lockedLabel}</td>
					</tr>
					<tr>
						<td>Climate</td>
						<td>{climateLabel}</td>
					</tr>
				</tbody>
			</table>

			{!paired && !pairingUnknown && flowOpen && (
				<div className="pairing-flow">
					<p>
						Open the link below on your phone. The Tesla app will
						prompt you to add Nikola as a trusted key for your
						vehicle. Then come back and confirm.
					</p>
					<a href={PAIRING_URL} target="_blank" rel="noreferrer">
						<button>Open Tesla app to pair</button>
					</a>
					&nbsp;
					<button
						onClick={onConfirmPairing}
						disabled={pairingVerifying}
					>
						{pairingVerifying
							? "Waking car & verifying… (up to 10 s)"
							: "I've paired it"}
					</button>
				</div>
			)}

		</section>
	);
}
