"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ExtrudeGeometry, Mesh } from "three";

type Props = {
  geometry: ExtrudeGeometry;
};

/**
 * Centered mesh with soft PBR material and gentle idle spin on Y.
 */
export function Model({ geometry }: Props) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;
    m.rotation.y += delta * 0.42;
  });

  return (
    <mesh ref={meshRef} castShadow geometry={geometry} position={[0, 0.15, 0]}>
      <meshPhysicalMaterial
        color="#c5d2e3"
        metalness={0.18}
        roughness={0.28}
        clearcoat={0.62}
        clearcoatRoughness={0.16}
        envMapIntensity={1}
      />
    </mesh>
  );
}
