import { useState } from "react";

import { Model_3 } from "./TeslaModel3";
import { lightRig } from "../lightRig";
import { Headlights } from "../LightSwitches";
import { Taillights } from "../LightSwitches";
import { HeadAndTailLights } from "../LightSwitches";
import "../css/LightLab.css";

type Props = {
	onClose: () => void;
};

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

export default function LightLab({ onClose }: Props) {
	return (
		<div className="lightlab">
			<header className="lightlab-header">
				<h2>Light Lab</h2>
				<p>

				</p>
				<button onClick={onClose}>Back to dashboard</button>
			</header>

			<div className="lightlab-body">
				<div className="lightlab-stage">
					<Model_3 />
				</div>

				<div className="lightlab-panel">
					<button
						className="lightlab-action"
						onClick={() => Headlights()}
					>
						Flash Headlights
					</button>

					<button
						className="lightlab-action"
						onClick={() => Taillights()}
					>
						Flash Taillights
					</button>

					<button
						className="lightlab-action"
						onClick={() => HeadAndTailLights()}
					>
						Flash All
					</button>

					<LightToggle
						label="Key spotlight"
						defaultChecked={lightRig.key.on}
						onChange={(on) => (lightRig.key.on = on)}
					/>
					<LightSlider
						label="Key intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={lightRig.key.i}
						onChange={(v) => (lightRig.key.i = v)}
					/>

					<LightToggle
						label="Fill spotlight"
						defaultChecked={lightRig.fill.on}
						onChange={(on) => (lightRig.fill.on = on)}
					/>
					<LightSlider
						label="Fill intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={lightRig.fill.i}
						onChange={(v) => (lightRig.fill.i = v)}
					/>

					<LightToggle
						label="Overhead (casts the shadow)"
						defaultChecked={lightRig.overhead.on}
						onChange={(on) =>
							(lightRig.overhead.on = on)
						}
					/>
					<LightSlider
						label="Overhead intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={lightRig.overhead.i}
						onChange={(v) => (lightRig.overhead.i = v)}
					/>

					<LightToggle
						label="Environment (HDRI)"
						defaultChecked={lightRig.env.on}
						onChange={(on) => (lightRig.env.on = on)}
					/>

					<LightSlider
						label="Env intensity"
						min={0}
						max={1}
						step={0.01}
						defaultValue={lightRig.env.i}
						onChange={(v) => (lightRig.env.i = v)}
					/>

					<LightToggle
						label="Extra spotlight"
						defaultChecked={lightRig.spot.on}
						onChange={(on) => (lightRig.spot.on = on)}
					/>
					<LightSlider
						label="Spot X"
						min={-30}
						max={30}
						step={0.5}
						defaultValue={lightRig.spot.x}
						onChange={(v) => (lightRig.spot.x = v)}
					/>
					<LightSlider
						label="Spot Y"
						min={0}
						max={50}
						step={0.5}
						defaultValue={lightRig.spot.y}
						onChange={(v) => (lightRig.spot.y = v)}
					/>
					<LightSlider
						label="Spot Z"
						min={-30}
						max={30}
						step={0.5}
						defaultValue={lightRig.spot.z}
						onChange={(v) => (lightRig.spot.z = v)}
					/>
					<LightSlider
						label="Target X"
						min={-15}
						max={15}
						step={0.5}
						defaultValue={lightRig.spot.tx}
						onChange={(v) => (lightRig.spot.tx = v)}
					/>
					<LightSlider
						label="Target Y"
						min={0}
						max={10}
						step={0.1}
						defaultValue={lightRig.spot.ty}
						onChange={(v) => (lightRig.spot.ty = v)}
					/>
					<LightSlider
						label="Target Z"
						min={-15}
						max={15}
						step={0.5}
						defaultValue={lightRig.spot.tz}
						onChange={(v) => (lightRig.spot.tz = v)}
					/>
					<LightSlider
						label="Cone angle°"
						min={5}
						max={80}
						step={1}
						defaultValue={lightRig.spot.angle}
						onChange={(v) => (lightRig.spot.angle = v)}
					/>
					<LightSlider
						label="Penumbra"
						min={0}
						max={1}
						step={0.05}
						defaultValue={lightRig.spot.penumbra}
						onChange={(v) =>
							(lightRig.spot.penumbra = v)
						}
					/>
					<LightSlider
						label="Spot intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={lightRig.spot.i}
						onChange={(v) => (lightRig.spot.i = v)}
					/>
				</div>
			</div>
		</div>
	);
}
