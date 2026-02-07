"use client";

import dynamic from "next/dynamic";

const MapLibreMapInner = dynamic(() => import("./LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center bg-[var(--bg-elevated)] rounded-2xl" style={{ height: "60vh" }}>
      <span className="text-sm text-[var(--text-muted)]">Загрузка карты...</span>
    </div>
  ),
});

export default function LeafletMap(props) {
  return <MapLibreMapInner {...props} />;
}
