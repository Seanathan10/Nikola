export type LightRig = {
	spot: {
		x:         number;
		y:         number;
		z:         number;
		tx:        number;
		ty:        number;
		tz:        number;
		i:         number;
		angle:     number;
		penumbra:  number;
		on:        boolean;
	};
	env:       { i: number; on: boolean };
	key:       { i: number; on: boolean };
	fill:      { i: number; on: boolean };
	overhead:  { i: number; on: boolean };
};

export const lightRig: LightRig = {
	spot: {
		x:            11,
		y:            14,
		z:           9.5,
		tx:            4,
		ty:          1.8,
		tz:          2.5,
		i:          2600,
		angle:        26,
		penumbra:      1,
		on:        false,
	},

	env:       { i:  0.12, on: true },
	key:       { i: 15000, on: true },
	fill:      { i:  4500, on: true },
	overhead:  { i: 12000, on: true },
};
