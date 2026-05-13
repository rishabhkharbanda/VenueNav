import dynamic from "next/dynamic";

const StrokeLab = dynamic(() => import("@/components/three/StrokeLab"), { ssr: false });

export default function Stroke3DPage() {
  return <StrokeLab />;
}
