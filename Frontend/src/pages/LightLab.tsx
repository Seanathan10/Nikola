import { useState } from "react";

import { Model_3 } from "./TeslaModel3";
import type { LightControls } from "./TeslaModel3";
import "../css/LightLab.css";

type Props = {
	lightControls: LightControls;
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

export default function LightLab({ lightControls, onClose }: Props) {
	const c = lightControls.current;

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
					<Model_3 lightControls={lightControls} />
				</div>

				<div className="lightlab-panel">
					<LightToggle
						label="Key spotlight"
						defaultChecked={c.key.on}
						onChange={(on) => (lightControls.current.key.on = on)}
					/>
					<LightSlider
						label="Key intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={c.key.i}
						onChange={(v) => (lightControls.current.key.i = v)}
					/>

					<LightToggle
						label="Fill spotlight"
						defaultChecked={c.fill.on}
						onChange={(on) => (lightControls.current.fill.on = on)}
					/>
					<LightSlider
						label="Fill intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={c.fill.i}
						onChange={(v) => (lightControls.current.fill.i = v)}
					/>

					<LightToggle
						label="Overhead (casts the shadow)"
						defaultChecked={c.overhead.on}
						onChange={(on) =>
							(lightControls.current.overhead.on = on)
						}
					/>
					<LightSlider
						label="Overhead intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={c.overhead.i}
						onChange={(v) => (lightControls.current.overhead.i = v)}
					/>

					<LightToggle
						label="Environment (HDRI)"
						defaultChecked={c.env.on}
						onChange={(on) => (lightControls.current.env.on = on)}
					/>

					<LightSlider
						label="Env intensity"
						min={0}
						max={1}
						step={0.01}
						defaultValue={c.env.i}
						onChange={(v) => (lightControls.current.env.i = v)}
					/>

					<LightToggle
						label="Extra spotlight"
						defaultChecked={c.spot.on}
						onChange={(on) => (lightControls.current.spot.on = on)}
					/>
					<LightSlider
						label="Spot X"
						min={-30}
						max={30}
						step={0.5}
						defaultValue={c.spot.x}
						onChange={(v) => (lightControls.current.spot.x = v)}
					/>
					<LightSlider
						label="Spot Y"
						min={0}
						max={50}
						step={0.5}
						defaultValue={c.spot.y}
						onChange={(v) => (lightControls.current.spot.y = v)}
					/>
					<LightSlider
						label="Spot Z"
						min={-30}
						max={30}
						step={0.5}
						defaultValue={c.spot.z}
						onChange={(v) => (lightControls.current.spot.z = v)}
					/>
					<LightSlider
						label="Target X"
						min={-15}
						max={15}
						step={0.5}
						defaultValue={c.spot.tx}
						onChange={(v) => (lightControls.current.spot.tx = v)}
					/>
					<LightSlider
						label="Target Y"
						min={0}
						max={10}
						step={0.1}
						defaultValue={c.spot.ty}
						onChange={(v) => (lightControls.current.spot.ty = v)}
					/>
					<LightSlider
						label="Target Z"
						min={-15}
						max={15}
						step={0.5}
						defaultValue={c.spot.tz}
						onChange={(v) => (lightControls.current.spot.tz = v)}
					/>
					<LightSlider
						label="Cone angle°"
						min={5}
						max={80}
						step={1}
						defaultValue={c.spot.angle}
						onChange={(v) => (lightControls.current.spot.angle = v)}
					/>
					<LightSlider
						label="Penumbra"
						min={0}
						max={1}
						step={0.05}
						defaultValue={c.spot.penumbra}
						onChange={(v) =>
							(lightControls.current.spot.penumbra = v)
						}
					/>
					<LightSlider
						label="Spot intensity"
						min={0}
						max={40000}
						step={100}
						defaultValue={c.spot.i}
						onChange={(v) => (lightControls.current.spot.i = v)}
					/>
				</div>
			</div>
		</div>
	);
}
