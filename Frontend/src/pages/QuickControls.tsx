import "../css/QuickControls.css";

type Props = {
	onWake: () => void;
	onLock: () => void;
	onUnlock: () => void;
	onFlash: () => void;
	onCPLatch: () => void;
	onCP: () => void;
	onTrunk: () => void;
	onFrunk: () => void;
	onClimateOn: () => void;
	onClimateOff: () => void;
	disabled?: boolean;
	waking?: boolean;
};

export default function QuickControls({
	onWake,
	onLock,
	onUnlock,
	onFlash,
	onCPLatch,
	onCP,
	onTrunk,
	onFrunk,
	onClimateOn,
	onClimateOff,
	disabled = false,
	waking = false,
}: Props) {
	return (
		<section>
			<h2>Quick Controls</h2>
			<div className="controls-grid">
				<button onClick={onWake} disabled={waking}>
					Wake Tesla
				</button>
				<button onClick={onLock} disabled={disabled}>
					Lock
				</button>
				<button onClick={onUnlock} disabled={disabled}>
					Unlock
				</button>
				<button onClick={onFlash} disabled={disabled}>
					Flash
				</button>
				<button onClick={onCPLatch} disabled={disabled}>
					Release Charge Latch
				</button>
				<button onClick={onCP} disabled={disabled}>
					Toggle Charge Port
				</button>
				<button onClick={onTrunk} disabled={disabled}>
					Trunk
				</button>
				<button onClick={onFrunk} disabled={disabled}>
					Frunk
				</button>
				<button onClick={onClimateOn} disabled={disabled}>
					Climate On
				</button>
				<button onClick={onClimateOff} disabled={disabled}>
					Climate Off
				</button>
			</div>
		</section>
	);
}
