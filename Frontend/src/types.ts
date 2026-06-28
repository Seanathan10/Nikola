export type AuthStatus = {
	authenticated: boolean;
	expires_at: number | null;
};

export type PairingCheck = {
	status: "paired" | "unpaired";
	error?: never;
} | {
	status?: never;
	error: string;
};

export type ChargeFee = {
	currencyCode: string;
	feeType: string;
	isPaid: boolean;
	netDue: number;
	pricingType: string;
	rateBase: number;
	status: string;
	totalDue: number;
	uom: string;
	usageBase: number;
};

export type ChargeInvoice = {
	contentId: string;
	fileName: string;
	invoiceType: string;
};

export type ChargeSession = {
	billingType: string;
	chargeStartDateTime: string;
	chargeStopDateTime: string;
	countryCode: string;
	fees: ChargeFee[];
	invoices: ChargeInvoice[];
	sessionId: number;
	siteLocationName: string;
	unlatchDateTime: string;
	vehicleMakeType: string;
	vin: string;
};

export type ChargeHistory = {
	data: ChargeSession[];
};

export type VehicleState = {
	status: "awake";
	displayName: string;
	driveState: "parked" | "driving" | "reversing" | "neutral";
	batteryPercent: number | null;
	batteryRangeMi: number | null;
	batteryRangeKM: number | null;
	chargingState: string | null;
	locationName: string | null;
	locked: boolean | null;
	climateOn: boolean | null;
	chargeEnergyAdded: number | null;
	minutesToFullCharge: number | null;
	chargerPowerKw: number | null;
	chargerVoltage: number | null;
	chargerActualCurrent: number | null;
	chargeRateMph: number | null;
	chargeLimitSoc: number | null;
	chargeLimitSocMax: number | null;
	chargeLimitSocMin: number | null;
	chargeLimitSocStd: number | null;
	chargeMilesAddedRated: number | null;
	chargerPhases: number | null;
	chargerPilotCurrent: number | null;
	chargeCurrentRequest: number | null;
	chargeCurrentRequestMax: number | null;
	chargePortLatch: string | null;
	chargePortColor: string | null;
	connChargeCable: string | null;
	fastChargerPresent: boolean | null;
	fastChargerType: string | null;
	fastChargerBrand: string | null;
	scheduledChargingMode: string | null;
	scheduledChargingPending: boolean | null;
	scheduledChargingStartTime: number | null;
	offPeakChargingEnabled: boolean | null;
	usableBatteryLevel: number | null;
	batteryHeaterOn: boolean | null;
	idealBatteryRange: number | null;
	estBatteryRange: number | null;
	notEnoughPowerToHeat: boolean | null;
};
