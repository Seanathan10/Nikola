import * as THREE from "three";

export const TEXTURES = {
	Grille6_diff:     "/model3/tex/Grille6_diff.png",
	Grille6_nrml:     "/model3/tex/Grille6_nrml.png",
	Highbeam:         "/model3/tex/Highbeam.png",
	INT_Screen:       "/model3/tex/INT_Screen.png",
	Lowbeam:          "/model3/tex/Lowbeam.png",
	TEssuto:          "/model3/tex/TEssuto.png",
	TEssuto_NM:       "/model3/tex/TEssuto_NM.png",
	alcnt:            "/model3/tex/alcnt.png",
	carpet:           "/model3/tex/carpet.png",
	carpet_NM:        "/model3/tex/carpet_NM.png",
	cloth_detail:     "/model3/tex/cloth_detail.png",
	grid_front_d:     "/model3/tex/grid_front_d.png",
	grid_front_n:     "/model3/tex/grid_front_n.png",
	iconstesla:       "/model3/tex/iconstesla.png",
	leather_1:        "/model3/tex/leather_1.png",
	leather_2:        "/model3/tex/leather_2.png",
	leather_3:        "/model3/tex/leather_3.png",
	leather_nm:       "/model3/tex/leather_nm.png",
	screen_rear:      "/model3/tex/Untitled65_20240507113309.png",
	screen_color:     "/model3/tex/Untitled66_20240507130239.png",
	sbr_ao:           "/model3/tex/sbr_main_ao.data.png",
	sbr_color:        "/model3/tex/sbr_main_b.color.png",
	sbr_metal:        "/model3/tex/sbr_main_m.data.png",
	sbr_normal:       "/model3/tex/sbr_main_n.normal.png",
	sbr_rough:        "/model3/tex/sbr_main_r.data.png",
} as const;


export type TexKey = keyof typeof TEXTURES;
export type Textures = Record<TexKey, THREE.Texture>;


// each of these are electrical circuits for the car's lights, allowing on/off control
export type Circuit =
	| "headlight"
	| "brake"
	| "tail"
	| "indicatorL"
	| "indicatorR"
	| "reverse"
;

export const circuits: Record<Circuit, boolean> = {
	headlight: false,
	brake: false,
	tail: false,
	indicatorL: false,
	indicatorR: false,
	reverse: false,
};

type Rgb = [ number, number, number ];

type MaterialSpec = {
	map?: TexKey;
	normalMap?: TexKey;
	roughnessMap?: TexKey;
	metalnessMap?: TexKey;
	aoMap?: TexKey;
	emissiveMap?: TexKey;
	alphaMap?: TexKey;
	emissive?: Rgb;
	emissiveIntensity?: number;
	// if set, the glow is off until the circuit is switched on
	circuit?: Circuit;
};

const SPECS: Record<string, MaterialSpec> = {
	Model3_2024_lowbeam: {
		map: "Lowbeam",
		emissiveMap: "Lowbeam",
		emissive: [0.8, 0.8, 1.0],
		// emissiveIntensity: 3.922,
		emissiveIntensity: 10,
		circuit: "headlight",
	},
	Model3_2024_highbeam: {
		map: "Highbeam",
		emissiveMap: "Highbeam",
		emissive: [0.7143, 0.7143, 1.0],
		// emissiveIntensity: 2.745,
		emissiveIntensity: 10,
		circuit: "headlight",
	},
	Model3_2024_highbeam2: {
		map: "Lowbeam",
		emissiveMap: "Lowbeam",
		emissive: [0.8, 0.8, 1.0],
		// emissiveIntensity: 3.922,
		emissiveIntensity: 10,
		circuit: "headlight",
	},

	// daytime running lights, basically the thin always-on lights
	Model3_2024_running: {
		emissive: [0.7692, 0.7692, 1.0],
		emissiveIntensity: 5.098,
		circuit: "headlight",
	},

	Model3_2024_taillight: {
		emissive: [1.0, 0.0, 0.004],
		emissiveIntensity: 4.902,
		circuit: "tail",
	},
	Model3_2024_brake: {
		emissive: [1.0, 0.0033, 0.0],
		emissiveIntensity: 5.882,
		circuit: "brake",
	},
	Model3_2024_brake_high: {
		emissive: [1.0, 0.0, 0.0007],
		emissiveIntensity: 27.451,
		circuit: "brake",
	},
	Model3_2024_signal_L: {
		emissive: [1.0, 0.24, 0.0],
		emissiveIntensity: 4.902,
		circuit: "indicatorL",
	},
	Model3_2024_signal_R: {
		emissive: [1.0, 0.24, 0.0],
		emissiveIntensity: 4.902,
		circuit: "indicatorR",
	},
	Model3_2024_reverse: {
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 5.882,
		circuit: "reverse",
	},


	// da internal light strip
	// looks cool as hell
	Model3_2024_LED: {
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 11.765
	},


	//  general brightness of the main iPad
	Model3_2024_screen: {
		map: "INT_Screen",
		emissiveMap: "INT_Screen",
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 1,
	},

	Model3_2024_screen_rear: {
		map: "screen_rear",
		emissiveMap: "screen_rear",
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 1,
	},

	// after some testing, this is the autopilot preview car on the left half
	Model3_2024_screen_color: {
		map: "screen_color",
		emissiveMap: "screen_color",
		roughnessMap: "screen_color",
		alphaMap: "screen_color",
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 1,
	},

	// this is the right half, where google maps usually is
	Model3_2024_nav: {
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 0.5
	},

	// what looks to be the blue Start Agentic Driving button
	Model3_2024_speedometer: {
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 0.5
	},

	// cool as hell: the brightness of the steering wheel buttons
	Model3_2024_decal: {
		map: "iconstesla",
		emissiveMap: "iconstesla",
		emissive: [1.0, 1.0, 1.0],
		emissiveIntensity: 10,
	},


	Model3_2024_PRND: {
		map: "iconstesla"
	},


	Model3_2024_leather: { map: "leather_1", normalMap: "leather_nm" },
	Model3_2024_leather2: { map: "leather_2" },
	Model3_2024_leather3: { map: "leather_3" },
	Model3_2024_fabric: { map: "alcnt" },
	Model3_2024_carpet: { map: "carpet", normalMap: "carpet_NM" },
	Model3_2024_headliner: { map: "TEssuto", normalMap: "TEssuto_NM" },
	Model3_2024_seatbelt: { map: "cloth_detail" },
	Model3_2024_speaker: { map: "Grille6_diff", normalMap: "Grille6_nrml" },
	Model3_2024_grille: { map: "grid_front_d", normalMap: "grid_front_n" },


	Model3_2024_mechanical: {
		map: "sbr_color",
		normalMap: "sbr_normal",
		roughnessMap: "sbr_rough",
		metalnessMap: "sbr_metal",
		aoMap: "sbr_ao",
	},
};


// see this is the place where the environment gets amplified onto the paint
// despite being set low initially
const ENV_BOOST: Record<string, number> = {
	Model3_2024_paint: 9,
	Model3_2024_silver: 9,
	mirror: 9,
};
const ENV_DEFAULT = 1;


// glass too opaque, so select all of it to later reduce it
const GLASS_MATERIALS = [
	"Model3_2024_glass",
	"Model3_2024_glass.001",
	"Model3_2024_glass_tinted",
	"Model3_2024_taillight_glass"
];

// headlights originally had an alpha of 0.486 and blocked way too much light
// this allows the Flash Headlights function to look nice
const LENS_MATERIAL = "Model3_2024_glass.001";
const LENS_OPACITY = 0.1;


const dataClones = new Map<THREE.Texture, THREE.Texture>();

function asData(tex: THREE.Texture) {
	let clone = dataClones.get(tex);
	if (!clone) {
		clone = tex.clone();
		clone.colorSpace = THREE.NoColorSpace;
		clone.needsUpdate = true;
		dataClones.set(tex, clone);
	}
	return clone;
}

function asColor(tex: THREE.Texture) {
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

export function tuneMaterial(
	mat: THREE.MeshPhysicalMaterial,
	tex: Textures,
) {
	mat.envMapIntensity = ENV_BOOST[mat.name] ?? ENV_DEFAULT;

	if ( mat.name === LENS_MATERIAL ) {
		mat.transparent = true;
		mat.opacity = LENS_OPACITY;
	}

	if (GLASS_MATERIALS.includes(mat.name)) {
		mat.metalness = 0;
		mat.roughness = 0;
	}

	const spec = SPECS[mat.name];
	if (!spec) return;

	if (spec.map) mat.map = asColor(tex[spec.map]);
	if (spec.emissiveMap) mat.emissiveMap = asColor(tex[spec.emissiveMap]);
	if (spec.normalMap) mat.normalMap = asData(tex[spec.normalMap]);
	if (spec.roughnessMap) mat.roughnessMap = asData(tex[spec.roughnessMap]);
	if (spec.metalnessMap) mat.metalnessMap = asData(tex[spec.metalnessMap]);
	if (spec.aoMap) mat.aoMap = asData(tex[spec.aoMap]);
	if (spec.alphaMap) {
		mat.alphaMap = asData(tex[spec.alphaMap]);
		mat.transparent = true;
	}

	if (spec.emissive) {
		mat.emissive.setRGB(...spec.emissive);
		const lit = spec.emissiveIntensity ?? 1;

		if (spec.circuit) {
			mat.userData.litIntensity = lit;
			mat.userData.circuit = spec.circuit;
			mat.emissiveIntensity = 0;
			switched.add(mat);
		} else {
			mat.emissiveIntensity = lit;
		}
	}

	mat.needsUpdate = true;
}


const switched = new Set<THREE.MeshPhysicalMaterial>();

export function applyCircuits() {
	for (const mat of switched) {
		const on = circuits[mat.userData.circuit as Circuit];
		mat.emissiveIntensity = on ? (mat.userData.litIntensity as number) : 0;
	}
}
