"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 900;

/**
 * Subtle drifting dust for depth; single draw call.
 */
export function AmbientParticles() {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 45 + 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useLayoutEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame((_, dt) => {
    const p = points.current;
    if (!p) return;
    p.rotation.y += dt * 0.018;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.045}
        color="#8ea4ff"
        transparent
        opacity={0.28}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
