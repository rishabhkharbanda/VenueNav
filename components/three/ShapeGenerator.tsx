"use client";

import { useEffect, useMemo } from "react";
import type { Point2 } from "@/lib/geometry";
import { createStrokeExtrudeGeometry } from "@/lib/strokeToMesh";
import { Model } from "@/components/three/Model";
import { Scene } from "@/components/three/Scene";

type Props = {
  /** 2D stroke in arbitrary units; normalized & centered internally. */
  points: Point2[];
};

/**
 * Builds extruded geometry from `points` and renders it inside a lit R3F scene.
 */
export function ShapeGenerator({ points }: Props) {
  const geometry = useMemo(() => createStrokeExtrudeGeometry(points), [points]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 360 }}>
      <Scene>
        <Model geometry={geometry} />
      </Scene>
    </div>
  );
}
