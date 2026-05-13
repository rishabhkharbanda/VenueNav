"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Sparkles } from "@react-three/drei";
import { useExperienceStore } from "@/store/experienceStore";
import { FallingPiece } from "@/components/experience/FallingPiece";
import { AmbientParticles } from "@/components/experience/AmbientParticles";

const FLOOR_Y = -2.36;

export function RainCanvas() {
  const rain = useExperienceStore((s) => s.rain);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 2.4, 14.2], fov: 40, near: 0.1, far: 120 }}
      >
        <color attach="background" args={["#040510"]} />
        <fog attach="fog" args={["#040510", 14, 52]} />

        <ambientLight intensity={0.22} />
        <directionalLight
          castShadow
          position={[6.5, 11, 5]}
          intensity={1.15}
          color="#dbeafe"
          shadow-mapSize={[1536, 1536]}
          shadow-camera-far={60}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-4, 5, -3]} intensity={0.35} color="#c4b5fd" />

        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        <AmbientParticles />
        <Sparkles
          count={160}
          scale={[26, 14, 26]}
          size={2.2}
          speed={0.35}
          opacity={0.35}
          color="#7dd3fc"
          position={[0, 2.2, 0]}
        />

        {rain.map((item) => (
          <FallingPiece key={item.id} item={item} />
        ))}

        <ContactShadows
          position={[0, FLOOR_Y, 0]}
          opacity={0.55}
          scale={18}
          blur={2.6}
          far={6}
          color="#050816"
        />
        <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y - 0.01, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <shadowMaterial transparent opacity={0.2} />
        </mesh>
      </Canvas>
    </div>
  );
}