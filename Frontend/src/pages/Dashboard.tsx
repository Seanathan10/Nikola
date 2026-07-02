import { useRef, useState, useEffect, useCallback } from "react";

import VehicleStatus from "./VehicleStatus";
import ChargeStats from "./ChargeStats";
import QuickControls from "./QuickControls";
import ChargeHistory from "./ChargeHistory";

import type {
	ChargeHistory as ChargeHistoryType,
	VehicleState,
	PairingCheck,
} from "../types";

import "../css/Dashboard.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const PAIRING_URL = "https://tesla.com/_ak/nikola.byseansingh.com";

type Props = {
	onLogout: () => void;
	pairing: PairingCheck | null;
	pairingVerifying: boolean;
	onVerifyPairing: () => void;
	onConfirmPairing: () => void;
};

function PairingBanner({
	pairing,
	verifying,
	onVerify,
	onConfirm,
}: {
	pairing: PairingCheck | null;
	verifying: boolean;
	onVerify: () => void;
	onConfirm: () => void;
}) {
	const [flowOpen, setFlowOpen] = useState(false);

	if (verifying && !pairing) return <p>Checking virtual key pairing...</p>;

	if (!pairing || pairing.error) {
		return (
			<p>
				Virtual key: unknown &nbsp;
				<button onClick={onVerify} disabled={verifying}>
					Check
				</button>
			</p>
		);
	}

	if (pairing.status === "paired") {
		return <p>Virtual key: paired</p>;
	}

	return (
		<div>
			<p>
				Virtual key: not paired &nbsp;
				<button onClick={() => setFlowOpen((o) => !o)}>
					{flowOpen ? "Hide" : "Pair virtual key"}
				</button>
			</p>

			{flowOpen && (
				<div>
					<p>
						Open the link below on your phone. The Tesla app will
						prompt you to add Nikola as a trusted key for your
						vehicle. Then come back and confirm.
					</p>
					<a href={PAIRING_URL} target="_blank" rel="noreferrer">
						<button>Open Tesla app to pair</button>
					</a>
					&nbsp;
					<button onClick={onConfirm} disabled={verifying}>
						{verifying
							? "Waking car & verifying… (up to 10 s)"
							: "I've paired it"}
					</button>
				</div>
			)}
		</div>
	);
}

export default function Dashboard({
	onLogout,
	pairing,
	pairingVerifying,
	onVerifyPairing,
	onConfirmPairing,
}: Props) {
	const [chargeHistory, setChargeHistory] =
		useState<ChargeHistoryType | null>(null);
	const [historyLoading, setHistoryLoading] = useState(false);
	const [vehicleState, setVehicleState] = useState<VehicleState | null>(null);
	const [vehicleLoading, setVehicleLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [wakeStatus, setWakeStatus] = useState<string>("unknown");
	const [vehicleAsleep, setVehicleAsleep] = useState(false);
	const [isWaking, setIsWaking] = useState(false);

	const fetchVehicleState = useCallback(async () => {
		setVehicleLoading(true);
		try {
			const res = await fetch(`${API}/api/vehicle/state`, { credentials: "include" });
			const data = await res.json();

			if (data.status === "awake") {
				setVehicleState(data);
				setVehicleAsleep(false);
				setError(null);
			} else if (data.status === "asleep") {
				setVehicleAsleep(true);
				setError("Vehicle is sleeping");
			} else if (data.status === "unreachable") {
				setError(
					"Vehicle is unreachable - server error or vehicle has no connection.",
				);
			} else {
				setError(
					"Failed to get vehicle state: " +
						(data.error ?? "unexpected response"),
				);
			}
		} catch (e) {
			if (e instanceof window.Error) {
				setError("Failed to get vehicle state: " + e.message);
			} else {
				setError(
					"Failed to get vehicle state: An unknown error occurred",
				);
			}
		} finally {
			setVehicleLoading(false);
		}
	}, []);

	// useEffect(() => {
	// 	if (
	// 		pairing &&
	// 		!pairing.error &&
	// 		pairing.status === "paired" &&
	// 		!vehicleState
	// 	) {
	// 		fetchVehicleState();
	// 	}
	// }, [pairing, vehicleState, fetchVehicleState]);

	const hasFetched = useRef(false);

	useEffect(() => {
		if (
			pairing &&
			!pairing.error &&
			pairing.status === "paired" &&
			!vehicleState &&
			!hasFetched.current
		) {
			hasFetched.current = true; // Mark it immediately

			const timer = setTimeout(() => {
				fetchVehicleState();
			}, 0);

			return () => clearTimeout(timer);
		}
	}, [pairing, vehicleState, fetchVehicleState]);

	const handleVerifyAndConfirm = async () => {
		setVehicleLoading(true);
		setError(null);
		try {
			const res = await fetch(`${API}/api/pairing/confirm`, {
				method: "POST",
				credentials: "include",
			});
			const data = await res.json();
			if (data.verified) {
				setVehicleState(data.vehicle);
				onConfirmPairing();
			} else {
				const detail =
					data.error && data.error !== data.message
						? ` (${data.error})`
						: "";
				setError(
					(data.message ?? "Could not verify pairing.") + detail,
				);
			}
		} catch (e) {
			setError("Verification request failed: " + e);
		} finally {
			setVehicleLoading(false);
		}
	};

	const fetchChargeHistory = async () => {
		setHistoryLoading(true);
		try {
			const res = await fetch(`${API}/api/charging/history`, { credentials: "include" });
			const data = await res.json();
			setChargeHistory(data);
		} catch (e) {
			setError("Failed to fetch charging history: " + e);
		} finally {
			setHistoryLoading(false);
		}
	};

	// old version
	// curl -X POST "https://api.nikola.byseansingh.com/api/trunk" -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN"

	const handleWake = async () => {
		setIsWaking(true);
		setWakeStatus("waking");
		try {
			const res = await fetch(`${API}/api/wake`, { method: "POST", credentials: "include" });
			const data = await res.json();
			if (!data.ok) {
				setWakeStatus("unknown");
				setError("Wake failed: " + (data.error ?? "unknown error"));
				setIsWaking(false);
				return;
			}
		} catch (E) {
			setWakeStatus("unknown");
			setError("Wake failed: " + E);
			setIsWaking(false);
			return;
		}

		const maxAttempts = 3;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			// visible countdown before each online check
			for (let s = 5; s > 0; s--) {
				setWakeStatus(
					`waking — check ${attempt}/${maxAttempts} in ${s}s`,
				);
				await new Promise((r) => setTimeout(r, 1000));
			}
			setWakeStatus(`waking — checking (${attempt}/${maxAttempts})`);

			try {
				const res = await fetch(`${API}/api/vehicle/online`, { credentials: "include" });
				const data = await res.json();
				if (data.online) {
					setWakeStatus("online");
					setIsWaking(false);

					await fetchVehicleState(); // clears the asleep error

					return;
				}
				if (data.state)
					setWakeStatus(
						`${data.state} — check ${attempt}/${maxAttempts} failed`,
					);
			} catch {
				console.log("failed to check if car is awake");
			}
		}

		setWakeStatus("timed out — try again");
		setIsWaking(false);
	};

	const handleTrunk = async () => {
		try {
			const res = await fetch(`${API}/api/trunk`, { method: "POST", credentials: "include" });
			const data = await res.json();
			if (!data.ok)
				setError(
					"Trunk command failed: " + (data.error ?? "unknown error"),
				);
		} catch (E) {
			setError("Trunk command failed: " + E);
		}
	};

	const handleFlash = async () => {
		try {
			const res = await fetch(`${API}/api/flash`, { method: "POST", credentials: "include" });
			const data = await res.json();

			if (!data.ok) {
				setError("Flash failed: " + (data.error ?? "unkown error"));
			}
		} catch (E) {
			setError("Flash failed: " + E);
		}
	};

	const handleCP = async () => {
		try {
			const res = await fetch(`${API}/api/cp`, { method: "POST", credentials: "include" });
			const data = await res.json();

			if (!data.ok) {
				setError(
					"charge port failed: " + (data.error ?? "unkown error"),
				);
			}
		} catch (E) {
			setError("cxharge port failed: " + E);
		}
	};

	const handleCPLatch = async () => {
		try {
			const res = await fetch(`${API}/api/cplatch`, { method: "POST", credentials: "include" });
			const data = await res.json();

			if (!data.ok) {
				setError(
					"charge port latch command failed: " +
						(data.error ?? "unkown error"),
				);
			}
		} catch (E) {
			setError("cxharge port latch failed: " + E);
		}
	};

	const noop = () => {};

	return (
		<div className="dashboard">
			<header className="dashboard-header">
				<h1>Nikola</h1>
				<button onClick={onLogout}>Log Out</button>
			</header>

			<PairingBanner
				pairing={pairing}
				verifying={pairingVerifying || vehicleLoading}
				onVerify={onVerifyPairing}
				onConfirm={handleVerifyAndConfirm}
			/>

			{error && <p>{error}</p>}

			<div className="dashboard-top">
				<VehicleStatus
					vehicle={vehicleState}
					loading={vehicleLoading}
					wakeStatus={wakeStatus}
				/>
				<QuickControls
					disabled={vehicleAsleep}
					waking={isWaking}
					onWake={handleWake}
					onLock={noop}
					onUnlock={noop}
					onFlash={handleFlash}
					onCPLatch={handleCPLatch}
					onCP={handleCP}
					onTrunk={handleTrunk}
					onFrunk={noop}
					onClimateOn={noop}
					onClimateOff={noop}
				/>
			</div>

			<div className="dashboard-stats">
				<ChargeStats vehicle={vehicleState} />
			</div>

			<div className="dashboard-bottom">
				<ChargeHistory
					sessions={chargeHistory?.data ?? null}
					loading={historyLoading}
					onFetch={fetchChargeHistory}
				/>
			</div>
		</div>
	);
}
