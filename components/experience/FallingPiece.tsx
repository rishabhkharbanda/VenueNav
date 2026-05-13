"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RainItem } from "@/store/experienceStore";
import { playThudSound } from "@/lib/soundKit";

const FLOOR = -2.36;
const GRAVITY = -11.4;

type Props = { item: RainItem };

/**
 * Lightweight pseudo-physics: gravity, mild sway, damped floor bounce.
 */
export function FallingPiece({ item }: Props) {
  const group = useRef<THREE.Group>(null);
  const phys = useRef({
    vel: new THREE.Vector3(),
    ang: new THREE.Vector3(),
    spawn: 0,
    lastThud: -1,
  });
  const wobbleRef = useRef(0);

  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    wobbleRef.current = Math.random() * Math.PI * 2;
    const x = (Math.random() - 0.5) * 5.4;
    const y = 8.1 + Math.random() * 2.4;
    const z = (Math.random() - 0.5) * 4.8;
    g.position.set(x, y, z);
    g.scale.setScalar(0.001);
    phys.current.spawn = 0;
    phys.current.lastThud = -1;
    phys.current.vel.set(
      (Math.random() - 0.5) * 0.7,
      -0.2 - Math.random() * 0.55,
      (Math.random() - 0.5) * 0.7,
    );
    phys.current.ang.set(
      (Math.random() - 0.5) * 2.1,
      (Math.random() - 0.5) * 2.1,
      (Math.random() - 0.5) * 1.8,
    );
  }, [item.id]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(state.clock.getDelta(), 0.055);
    const t = state.clock.elapsedTime;

    phys.current.spawn = THREE.MathUtils.lerp(phys.current.spawn, 1, 1 - Math.exp(-8.2 * dt));
    const eased = 1 - Math.pow(1 - phys.current.spawn, 2.1);
    g.scale.setScalar(THREE.MathUtils.lerp(0.04, 1, eased));

    phys.current.vel.y += GRAVITY * dt;
    phys.current.vel.x += Math.sin(t * 1.25 + wobbleRef.current) * 0.028 * dt;
    phys.current.vel.z += Math.cos(t * 1.05 + wobbleRef.current) * 0.024 * dt;
    g.position.addScaledVector(phys.current.vel, dt);
    g.rotation.x += phys.current.ang.x * dt;
    g.rotation.y += phys.current.ang.y * dt;
    g.rotation.z += phys.current.ang.z * dt;

    if (g.position.y < FLOOR) {
      g.position.y = FLOOR;
      const vy = phys.current.vel.y;
      if (vy < -0.65 && t - phys.current.lastThud > 0.2) {
        phys.current.lastThud = t;
        playThudSound(Math.min(1, Math.abs(vy) / 8.5));
      }
      phys.current.vel.y *= -0.44;
      phys.current.vel.x *= 0.9;
      phys.current.vel.z *= 0.9;
      if (Math.abs(phys.current.vel.y) < 0.16) phys.current.vel.y = 0;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={item.geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={item.color}
          metalness={0.2}
          roughness={0.3}
          clearcoat={0.58}
          clearcoatRoughness={0.17}
          envMapIntensity={1.05}
        />
      </mesh>
    </group>
  );
}
