"use client";

import { Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";

type Props = {
  children: ReactNode;
};

/**
 * Neutral studio-like framing: soft shadow catcher, ambient + directional key light.
 */
export function Scene({ children }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [2.35, 1.85, 2.75], fov: 38, near: 0.1, far: 80 }}
    >
      <color attach="background" args={["#e6e8ee"]} />
      <ambientLight intensity={0.38} />
      <directionalLight
        castShadow
        position={[5.5, 9, 4.2]}
        intensity={1.25}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={40}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.00012}
      />
      <directionalLight position={[-3.5, 4, -2]} intensity={0.35} color="#dfe7ff" />

      <Suspense fallback={null}>
        <Environment preset="studio" />
      </Suspense>

      {children}

      <ContactShadows
        position={[0, -1.08, 0]}
        opacity={0.55}
        scale={14}
        blur={2.4}
        far={5.5}
        color="#1a1f2e"
      />

      <mesh rotation-x={-Math.PI / 2} position={[0, -1.09, 0]} receiveShadow>
        <planeGeometry args={[48, 48]} />
        <shadowMaterial transparent opacity={0.18} />
      </mesh>
    </Canvas>
  );
}
