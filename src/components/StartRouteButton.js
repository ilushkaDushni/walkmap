"use client";

import { useState } from "react";
import { Navigation, X } from "lucide-react";
import dynamic from "next/dynamic";

const RouteMapLeaflet = dynamic(() => import("./RouteMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[var(--bg-main)]">
      <span className="text-sm text-[var(--text-muted)]">Загрузка карты...</span>
    </div>
  ),
});

export default function StartRouteButton({ route }) {
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <div className="fixed inset-0 z-[60] bg-[var(--bg-main)] overflow-y-auto">
        <button
          onClick={() => setStarted(false)}
          className="absolute top-4 left-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-surface)]/90 backdrop-blur-sm shadow-[var(--shadow-md)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="px-4 py-14 pb-20 max-w-xl mx-auto">
          <RouteMapLeaflet route={route} autoStart />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setStarted(true)}
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-green-700 active:bg-green-800"
    >
      <Navigation className="h-5 w-5" />
      Начать маршрут
    </button>
  );
}
