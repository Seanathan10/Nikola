import {
	useRef,
	useMemo,
	Suspense,
	useLayoutEffect
} from "react";

import {
	Canvas,
	useFrame
} from "@react-three/fiber";

import {
	Center,
	useGLTF,
	useTexture,
	Environment,
	Lightformer,
	CameraControls,
	MeshReflectorMaterial
} from "@react-three/drei";

import * as THREE from "three";

import { lightRig } from "../lightRig";

import {
	EffectComposer,
	Bloom
} from "@react-three/postprocessing";

import {
	applyCircuits,
	tuneMaterial,
	TEXTURES
} from "../Materials";

import type { Textures } from "../Materials";

import {
	addTires,
	HUB_HEIGHT,
	TIRE_RADIUS
} from "../tires";


// const MODEL_PATH = "/tesla-model-3-2024/source/2024_tesla_model_3.glb";
const MODEL_PATH = "/tesla-model-3-2024/source/Untitled.glb";



// for some reason, this material ignores envMapIntensity, aka the floor always nabs the
// full scene. therefore i have set the global env to be very low
// and later amplified it onto the car's paint
function Ground() {
	return (
		<mesh
			rotation={[-Math.PI / 2, 0, 0]}
			position={[0, -0.01, 0]}
			receiveShadow
		>
			<planeGeometry args={[120, 120]} />
			<MeshReflectorMaterial
				resolution={1024}
				mixBlur={0.4}
				mixStrength={60}
				blur={[90, 40]}
				mirror={1}
				depthScale={1.1}
				minDepthThreshold={0.4}
				maxDepthThreshold={1.4}
				color="#050506"
				metalness={0.55}
				roughness={0.45}
			/>
		</mesh>
	);
}

// this is for the ground
function ShadowCatcher() {
	return (
		<mesh
			rotation={[-Math.PI / 2, 0, 0]}
			position={[0, 0.015, 0]}
			receiveShadow
		>
			<planeGeometry args={[60, 60]} />
			<shadowMaterial transparent opacity={0.55} color="#000000" />
		</mesh>
	);
}

function StudioEnvironment() {
	return (
		<Environment resolution={512}>
			<color attach="background" args={["#0b0b0d"]} />
			{/* long overhead strip: the highlight running along the roof/hood */}
			<Lightformer
				form="rect"
				intensity={9}
				position={[0, 16, 2]}
				rotation={[Math.PI / 2, 0, 0]}
				scale={[28, 10, 1]}
			/>
			{/* side panels: broad gradient down each flank */}
			<Lightformer
				form="rect"
				intensity={5}
				position={[18, 6, 6]}
				rotation={[0, -Math.PI / 2, 0]}
				scale={[24, 8, 1]}
			/>
			<Lightformer
				form="rect"
				intensity={3}
				position={[-18, 6, -4]}
				rotation={[0, Math.PI / 2, 0]}
				scale={[24, 8, 1]}
			/>
			{/* rim from behind, this one helps separates the car from the dark backdrop */}
			<Lightformer
				form="rect"
				intensity={5}
				position={[0, 7, -20]}
				rotation={[0, 0, 0]}
				scale={[20, 6, 1]}
			/>
		</Environment>
	);
}

const MODEL_SCALE = 3.9;

// the car rolls on its tyres now, not its rims: the contact patch is one tyre-radius below
// the hubs, and this drops that patch onto the floor
const GROUND_OFFSET = -(HUB_HEIGHT - TIRE_RADIUS) * MODEL_SCALE;

function TeslaModel() {
	const { scene } = useGLTF(MODEL_PATH);

	const tex = useTexture( TEXTURES ) as Textures;

	// if u dont memoize it then the car does not persist between pages
	// dumb but whatever, easy fix
	const car = useMemo(() => scene.clone(true), [scene]);

	useLayoutEffect(() => {
		// without this flipping disable, the lighting bleeds
		// very heavily into the wheel wells
		for (const t of Object.values(tex)) {
			t.flipY = false;
			t.needsUpdate = true;
		}

		car.traverse((obj) => {
			const mesh = obj as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.castShadow = true;
			mesh.receiveShadow = true;

			tuneMaterial(mesh.material as THREE.MeshPhysicalMaterial, tex);
		});

		addTires( car );
	}, [ car, tex ]);

	useFrame(() => applyCircuits());

	return (
		<primitive
			object={car}
			scale={MODEL_SCALE}
			position={[0, GROUND_OFFSET, 0]}
		/>
	);
}

type Vec3 = [number, number, number];

function FixedSpotlight({
	name,
	position,
	target,
	angle,
	penumbra,
	intensity,
	castShadow = false,
	control,
}: {
	name: string;
	position: Vec3;
	target: Vec3;
	angle: number;
	penumbra: number;
	intensity: number;
	castShadow?: boolean;
	control?: () => { i: number; on: boolean };
}) {
	const spotRef = useRef<THREE.SpotLight>(null);
	const targetRef = useRef<THREE.Object3D>(null);

	useLayoutEffect(() => {
		if (spotRef.current && targetRef.current) {
			spotRef.current.target = targetRef.current;
			targetRef.current.updateMatrixWorld();
		}
	}, []);

	useFrame(() => {
		if (!control || !spotRef.current) return;
		const { i, on } = control();
		spotRef.current.intensity = i;
		spotRef.current.visible = on;
	});

	return (
		<>
			<spotLight
				ref={spotRef}
				name={name}
				position={position}
				angle={THREE.MathUtils.degToRad(angle)}
				penumbra={penumbra}
				intensity={intensity}
				color="#fff5e0"
				distance={70}
				decay={2}
				castShadow={castShadow}
				shadow-mapSize={[2048, 2048]}
				shadow-bias={-0.0004}
				shadow-normalBias={0.05}
			/>
			<object3D ref={targetRef} position={target} />
		</>
	);
}

function SceneLights() {
	const spotRef = useRef<THREE.SpotLight>(null);
	const targetRef = useRef<THREE.Object3D>(null);


	useFrame((state) => {
		if (spotRef.current && targetRef.current) {
			const { x, y, z, tx, ty, tz, i, angle, penumbra, on } =
				lightRig.spot;

			spotRef.current.position.set(x, y, z);
			spotRef.current.intensity = i;
			spotRef.current.angle = THREE.MathUtils.degToRad(angle);
			spotRef.current.penumbra = penumbra;
			spotRef.current.visible = on;

			spotRef.current.target = targetRef.current;
			targetRef.current.position.set(tx, ty, tz);
			targetRef.current.updateMatrixWorld();
		}

		const env = lightRig.env;
		state.scene.environmentIntensity = env.on ? env.i : 0;
	});

	return (
		<>
			<spotLight
				ref={spotRef}
				position={[0, 6, 6]}
				angle={THREE.MathUtils.degToRad(35)}
				penumbra={0.4}
				intensity={600}
				color="#fff5e0"
				distance={25}
				decay={2}
			/>
			<object3D ref={targetRef} position={[0, 1, 1.2]} />
		</>
	);
}

useGLTF.preload(MODEL_PATH);

export function Model_3() {
	const slbrightness = 15000;
	return (
		<Canvas
			shadows
			dpr={[1, 1.5]}
			camera={{ position: [24, 6, 22], fov: 38 }}
			gl={{
				alpha: false,
				toneMapping: THREE.ACESFilmicToneMapping,
				toneMappingExposure: 1.15,
			}}
		>
			<CameraControls
				maxPolarAngle={Math.PI / 2 - 0.06}
				minPolarAngle={0.15}
				minDistance={14}
				maxDistance={90}
				truckSpeed={0}
			/>

			<color attach="background" args={["#0b0b0d"]} />

			<StudioEnvironment />

			<Suspense fallback={null}>
				<SceneLights />

				<FixedSpotlight
					name="key spotlight"
					position={[-13, 34, 15]}
					target={[-2, 1.5, 2]}
					angle={30}
					penumbra={1}
					intensity={slbrightness}
					control={() => lightRig.key}
				/>

				<FixedSpotlight
					name="fill spotlight"
					position={[14, 28, -11]}
					target={[2, 1.5, -2]}
					angle={34}
					penumbra={1}
					intensity={slbrightness * 0.3}
					control={() => lightRig.fill}
				/>

				<FixedSpotlight
					name="overhead shadow light"
					position={[0, 45, 0]}
					target={[0, 0, 0]}
					angle={22}
					penumbra={1}
					intensity={slbrightness * 0.8}
					castShadow
					control={() => lightRig.overhead}
				/>

				<Center disableY>
					<TeslaModel />
				</Center>
				<ShadowCatcher />
				<Ground />
			</Suspense>

			<EffectComposer>
				<Bloom
					luminanceThreshold={0.9}
					luminanceSmoothing={0.15}
					intensity={1.4}
					radius={0.7}
					mipmapBlur
				/>
			</EffectComposer>
		</Canvas>
	);
}
