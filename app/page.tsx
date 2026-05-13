import dynamic from "next/dynamic";

const ExperienceApp = dynamic(() => import("@/components/experience/ExperienceApp"), {
  ssr: false,
});

export default function Page() {
  return <ExperienceApp />;
}
