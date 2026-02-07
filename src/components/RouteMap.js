"use client";

import dynamic from "next/dynamic";

const RouteMapLeaflet = dynamic(() => import("./RouteMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)]" style={{ height: "300px" }}>
      <span className="text-sm text-[var(--text-muted)]">Загрузка карты...</span>
    </div>
  ),
});

export default function RouteMap({ route }) {
  return <RouteMapLeaflet route={route} />;
}
