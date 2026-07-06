import { useState } from "react";

import type { VehicleState, PairingCheck } from "../types";
import type { LightControls } from "./TeslaModel3";
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

	lightControls: LightControls;
};

const DASH = "—";

function LightSlider({
	label,
	min,
	max,
	step,
	defaultValue,
	onChange,
}: {
	label: string;
	min: number;
	max: number;
	step: number;
	defaultValue: number;
	onChange: (value: number) => void;
}) {
	const [value, setValue] = useState(defaultValue);

	const commit = (raw: number) => {
		const clamped = Math.min(max, Math.max(min, raw));
		setValue(clamped);
		onChange(clamped);
	};

	return (
		<label className="slider-row">
			<span>{label}</span>
			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => commit(Number(e.target.value))}
			/>
			<input
				className="slider-value"
				type="number"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => {
					const next = Number(e.target.value);
					if (e.target.value !== "" && Number.isFinite(next)) {
						commit(next);
					}
				}}
			/>
		</label>
	);
}

function LightToggle({
	label,
	defaultChecked,
	onChange,
}: {
	label: string;
	defaultChecked: boolean;
	onChange: (on: boolean) => void;
}) {
	return (
		<label className="toggle-row">
			<input
				type="checkbox"
				defaultChecked={defaultChecked}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<span>{label}</span>
		</label>
	);
}

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
	lightControls
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

			<div className="inputs">
				<LightToggle
					label="Spot light"
					defaultChecked={lightControls.current.spot.on}
					onChange={(on) => (lightControls.current.spot.on = on)}
				/>
				<LightSlider
					label="Spot X"
					min={-20}
					max={20}
					step={0.1}
					defaultValue={11}
					onChange={(v) => (lightControls.current.spot.x = v)}
				/>
				<LightSlider
					label="Spot Y"
					min={0}
					max={25}
					step={0.1}
					defaultValue={14}
					onChange={(v) => (lightControls.current.spot.y = v)}
				/>
				<LightSlider
					label="Spot Z"
					min={-20}
					max={20}
					step={0.1}
					defaultValue={9.5}
					onChange={(v) => (lightControls.current.spot.z = v)}
				/>
				<LightSlider
					label="Target X"
					min={-10}
					max={10}
					step={0.1}
					defaultValue={4}
					onChange={(v) => (lightControls.current.spot.tx = v)}
				/>
				<LightSlider
					label="Target Y"
					min={0}
					max={10}
					step={0.1}
					defaultValue={1.8}
					onChange={(v) => (lightControls.current.spot.ty = v)}
				/>
				<LightSlider
					label="Target Z"
					min={-10}
					max={10}
					step={0.1}
					defaultValue={2.5}
					onChange={(v) => (lightControls.current.spot.tz = v)}
				/>
				<LightSlider
					label="Cone angle°"
					min={5}
					max={80}
					step={1}
					defaultValue={26}
					onChange={(v) => (lightControls.current.spot.angle = v)}
				/>
				<LightSlider
					label="Penumbra"
					min={0}
					max={1}
					step={0.05}
					defaultValue={1}
					onChange={(v) => (lightControls.current.spot.penumbra = v)}
				/>
				<LightSlider
					label="Spot intensity"
					min={0}
					max={5000}
					step={10}
					defaultValue={2600}
					onChange={(v) => (lightControls.current.spot.i = v)}
				/>

				<LightToggle
					label="Environment (HDRI)"
					defaultChecked={lightControls.current.env.on}
					onChange={(on) => (lightControls.current.env.on = on)}
				/>
				<LightSlider
					label="Env intensity"
					min={0}
					max={3}
					step={0.05}
					defaultValue={0.08}
					onChange={(v) => (lightControls.current.env.i = v)}
				/>
			</div>
		</section>
	);
}
