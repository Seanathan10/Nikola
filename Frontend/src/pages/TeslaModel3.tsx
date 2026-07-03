import { useLayoutEffect, Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import {
	Environment,
	useGLTF,
	SpotLight,
} from "@react-three/drei";
import * as THREE from "three";
import { RepeatWrapping } from "three";

import { CameraControls } from "@react-three/drei";
import { Center } from "@react-three/drei";

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

function DramaticSpotlight() {
	return (
		<>
			<SpotLight
				position={[-4, 6, 4]}
				target-position={[0, 0.5, 0]}
				angle={0.35}
				penumbra={0.4}
				intensity={600}
				color="#fff5e0"
				castShadow
				distance={20}
				attenuation={6}
				anglePower={4}
			/>
			<pointLight
				position={[4, 3, -3]}
				intensity={8}
				color="#c8d8ff"
				distance={15}
			/>
		</>
	);
}

useGLTF.preload(MODEL_PATH);

export function Model_3() {
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

			<ambientLight intensity={0.4} color="#ffffff" />

			<color attach="background" args={["#1a1a1a"]} />

			<Environment preset="warehouse" environmentIntensity={0.3} />

			<Suspense fallback={null}>
				<DramaticSpotlight />
				<Center disableY>
					<TeslaModel />
				</Center>
				<Ground />
			</Suspense>
		</Canvas>
	);
}
