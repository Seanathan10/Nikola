import { useLayoutEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
	Environment,
	Lightformer,
	MeshReflectorMaterial,
	useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

import { CameraControls } from "@react-three/drei";
import { Center } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

const MODEL_PATH = "/tesla-model-3-2024/source/2024_tesla_model_3.glb";



function Ground() {
	const matRef = useRef<THREE.MeshStandardMaterial>(null);

	// The bright studio panels would otherwise light the floor into a grey slab.
	// Muting the env contribution on this material only keeps the floor near-black,
	// so what you see in it is the car's reflection.
	useLayoutEffect(() => {
		if (matRef.current) matRef.current.envMapIntensity = 0.05;
	}, []);

	return (
		<mesh
			rotation={[-Math.PI / 2, 0, 0]}
			position={[0, -0.01, 0]}
			receiveShadow
		>
			<planeGeometry args={[120, 120]} />
			<MeshReflectorMaterial
				ref={matRef}
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

// these are the long, smooth highlights that run down the flanks
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

function TeslaModel() {
	const { scene } = useGLTF(MODEL_PATH);

	useLayoutEffect(() => {
		scene.traverse((obj) => {
			if (obj.isMesh) {
				obj.castShadow = true;
				obj.receiveShadow = true;
				obj.material.envMapIntensity = 9;
			}
		});
	}, [scene]);

	return <primitive object={scene} />;
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
}: {
	name: string;
	position: Vec3;
	target: Vec3;
	angle: number;
	penumbra: number;
	intensity: number;
	castShadow?: boolean;
}) {
	const spotRef = useRef<THREE.SpotLight>(null);
	const targetRef = useRef<THREE.Object3D>(null);

	useLayoutEffect(() => {
		if (spotRef.current && targetRef.current) {
			spotRef.current.target = targetRef.current;
			targetRef.current.updateMatrixWorld();
		}
	}, []);

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

function SceneLights({ lightControls }: { lightControls: LightControls }) {
	const spotRef = useRef<THREE.SpotLight>(null);
	const targetRef = useRef<THREE.Object3D>(null);
	const scene = useThree((state) => state.scene);

	useFrame(() => {
		if (spotRef.current && targetRef.current) {
			const { x, y, z, tx, ty, tz, i, angle, penumbra, on } =
				lightControls.current.spot;

			spotRef.current.position.set(x, y, z);
			spotRef.current.intensity = i;
			spotRef.current.angle = THREE.MathUtils.degToRad(angle);
			spotRef.current.penumbra = penumbra;
			spotRef.current.visible = on;

			spotRef.current.target = targetRef.current;
			targetRef.current.position.set(tx, ty, tz);
			targetRef.current.updateMatrixWorld();
		}

		const env = lightControls.current.env;
		scene.environmentIntensity = env.on ? env.i : 0;
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

export type LightControls = React.MutableRefObject<{
	spot: {
		x: number;
		y: number;
		z: number;
		tx: number;
		ty: number;
		tz: number;
		i: number;
		angle: number;
		penumbra: number;
		on: boolean;
	};
	env: { i: number; on: boolean };
}>;

export function Model_3({ lightControls }: { lightControls: LightControls }) {
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
				<SceneLights lightControls={lightControls} />

				{/* Soft key from the camera's side, high and wide — shapes the
				    hood and front fender without pooling on the floor. */}
				<FixedSpotlight
					name="key spotlight"
					position={[-13, 34, 15]}
					target={[-2, 1.5, 2]}
					angle={30}
					penumbra={1}
					intensity={slbrightness}
				/>
				{/* Fill on the far flank, weaker, keeps the shadow side readable. */}
				<FixedSpotlight
					name="fill spotlight"
					position={[14, 28, -11]}
					target={[2, 1.5, -2]}
					angle={34}
					penumbra={1}
					intensity={slbrightness * 0.3}
				/>
				{/* Straight down from overhead. This is the only shadow caster:
				    a side light throws the shadow away from the camera, so it
				    vanishes from some orbit angles. */}
				<FixedSpotlight
					name="overhead shadow light"
					position={[0, 45, 0]}
					target={[0, 0, 0]}
					angle={22}
					penumbra={1}
					intensity={slbrightness * 0.8}
					castShadow
				/>

				<Center disableY>
					<TeslaModel />
				</Center>
				<Ground />
			</Suspense>
		</Canvas>
	);
}
