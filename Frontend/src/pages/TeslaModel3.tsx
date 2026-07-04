import { useLayoutEffect, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RepeatWrapping } from "three";

import { CameraControls } from "@react-three/drei";
import { Center } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

const MODEL_PATH = "/tesla-model-3-2024/source/2024_tesla_model_3.glb";

const CONCRETE_BASE =
	"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_02/concrete_floor_02_diff_1k.jpg";
const CONCRETE_NORMAL =
	"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_02/concrete_floor_02_nor_gl_1k.jpg";
const CONCRETE_ROUGH =
	"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_02/concrete_floor_02_rough_1k.jpg";

function Ground() {
	const [colorMap, normalMap, roughnessMap] = useLoader(THREE.TextureLoader, [
		CONCRETE_BASE,
		CONCRETE_NORMAL,
		CONCRETE_ROUGH,
	]);

	[colorMap, normalMap, roughnessMap].forEach((t) => {
		t.wrapS = t.wrapT = RepeatWrapping;
		t.repeat.set(4, 4);
	});

	return (
		<mesh
			rotation={[-Math.PI / 2, 0, 0]}
			position={[0, -0.01, 0]}
			receiveShadow
		>
			<planeGeometry args={[30, 30]} />
			<meshStandardMaterial
				map={colorMap}
				normalMap={normalMap}
				roughnessMap={roughnessMap}
				roughness={0.8}
				metalness={0.9}
			/>
		</mesh>
	);
}

function TeslaModel() {
	const { scene } = useGLTF(MODEL_PATH);

	useLayoutEffect(() => {
		scene.traverse((obj) => {
			if (obj.isMesh) {
				obj.castShadow = true;
				obj.receiveShadow = true;
				obj.material.envMapIntensity = 0.8;
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
}: {
	name: string;
	position: Vec3;
	target: Vec3;
	angle: number;
	penumbra: number;
	intensity: number;
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
				distance={25}
				decay={2}
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
	return (
		<Canvas
			shadows
			dpr={[1, 1.5]}
			camera={{ position: [-6, 3, 8], fov: 40 }}
			gl={{
				alpha: false,
				toneMapping: THREE.ACESFilmicToneMapping,
				toneMappingExposure: 0.9,
			}}
		>
			<CameraControls></CameraControls>

			<color attach="background" args={["#1a1a1a"]} />

			<Environment preset="warehouse" environmentIntensity={0.4} />

			<Suspense fallback={null}>
				<SceneLights lightControls={lightControls} />
				<FixedSpotlight
					name="overhead spotlight"
					position={[5.7, 10.7, -9.7]}
					target={[3.3, 1, -5.4]}
					angle={80}
					penumbra={1}
					intensity={940}
				/>
				<FixedSpotlight
					name="side spotlight"
					position={[-14, 3.6, 6.6]}
					target={[6.4, 2.4, -2.9]}
					angle={80}
					penumbra={1}
					intensity={940}
				/>
				<FixedSpotlight
					name="front right spotlight"
					position={[12, 3.6, 8.9]}
					target={[6.4, 2.4, 5.3]}
					angle={80}
					penumbra={1}
					intensity={940}
				/>
				<FixedSpotlight
					name="rear left"
					position={[-12, 3.6, -10.9]}
					target={[6.4, 2.4, 5.3]}
					angle={80}
					penumbra={1}
					intensity={940}
				/>
				<Center disableY>
					<TeslaModel />
				</Center>
				<Ground />
			</Suspense>
		</Canvas>
	);
}
