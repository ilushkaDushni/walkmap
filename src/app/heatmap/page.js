"use client";

import dynamic from "next/dynamic";

const HeatmapView = dynamic(() => import("@/components/HeatmapView"), {
  ssr: false,
});

export default function HeatmapPage() {
  return <HeatmapView />;
}
