import * as THREE from "three";

export const HUB_HEIGHT = 0.33;
export const TIRE_RADIUS = 0.327;
const TREAD_WIDTH = 0.245;
const BEAD_RADIUS = 0.235;
const IS_RIM = /^Model3_2024_rim/;
const HALF_W = TREAD_WIDTH / 2;

function buildTireGeometry() {
	const profile = [
		new THREE.Vector2( BEAD_RADIUS,  -HALF_W  *  0.96  ),
		new THREE.Vector2(       0.268,  -HALF_W  *  1.00  ),
		new THREE.Vector2(       0.298,  -HALF_W  *  1.03  ),
		new THREE.Vector2(       0.317,  -HALF_W  *  0.97  ),
		new THREE.Vector2( TIRE_RADIUS,  -HALF_W  *  0.80  ),
		new THREE.Vector2( TIRE_RADIUS,   HALF_W  *  0.80  ),
		new THREE.Vector2(       0.317,   HALF_W  *  0.97  ),
		new THREE.Vector2(       0.298,   HALF_W  *  1.03  ),
		new THREE.Vector2(       0.268,   HALF_W  *  1.00  ),
		new THREE.Vector2( BEAD_RADIUS,   HALF_W  *  0.96  ),
	];

	// LatheGeometry revolves around Y, but the wheels spin about X, so stand it up.
	const geo = new THREE.LatheGeometry( profile, 72 );

	geo.rotateZ( Math.PI / 2 );
	geo.computeVertexNormals();

	return geo;
}

const tireGeometry = buildTireGeometry();

const tireMaterial = new THREE.MeshStandardMaterial({
		 name:     "tire_rubber",
		color:         "#0b0b0c",
	roughness:              0.92,
	metalness:              0.00,
		 side:   THREE.DoubleSide,
});


export function addTires(car: THREE.Object3D) {
	const hubs: THREE.Object3D[] = [];

	car.traverse((obj) => {
		if (!IS_RIM.test(obj.name)) return;
		if (obj.parent && IS_RIM.test(obj.parent.name)) return;
		hubs.push(obj);
	});

	for (const hub of hubs) {
		if (hub.getObjectByName("tire")) continue;

		const tire = new THREE.Mesh(tireGeometry, tireMaterial);
		tire.name = "tire";
		tire.castShadow = true;
		tire.receiveShadow = true;

		hub.add(tire);
	}
}
