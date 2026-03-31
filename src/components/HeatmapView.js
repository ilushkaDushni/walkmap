"use client";

import { useState, useEffect, useCallback } from "react";
import Map, { Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Flame, Calendar, Satellite, Route, Crosshair } from "lucide-react";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Центр Ростова-на-Дону
const INITIAL_VIEW = {
  longitude: 39.7015,
  latitude: 47.2357,
  zoom: 13,
};

const RANGES = [
  { key: "all", label: "Всё время" },
  { key: "month", label: "Месяц" },
  { key: "week", label: "Неделя" },
];

const SOURCES = [
  { key: "hybrid", label: "Все", icon: Flame },
  { key: "routes", label: "Маршруты", icon: Route },
  { key: "gps", label: "GPS", icon: Satellite },
];

// MapLibre native heatmap layer paint
const heatmapPaint = {
  "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 10, 1],
  "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 2, 18, 3],
  "heatmap-color": [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0, "rgba(0,0,0,0)",
    0.1, "rgba(16,185,129,0.15)",
    0.25, "rgba(16,185,129,0.4)",
    0.4, "rgba(34,197,94,0.6)",
    0.55, "rgba(250,204,21,0.7)",
    0.7, "rgba(249,115,22,0.8)",
    0.85, "rgba(239,68,68,0.9)",
    1, "rgba(220,38,38,1)",
  ],
  "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 8, 13, 20, 16, 40, 18, 60],
  "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 18, 0.6],
};

export default function HeatmapView() {
  const [range, setRange] = useState("all");
  const [source, setSource] = useState("hybrid");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pointCount, setPointCount] = useState(0);
  const [viewState, setViewState] = useState(INITIAL_VIEW);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/heatmap?range=${range}&source=${source}`);
      const geojson = await res.json();
      setData(geojson);
      setPointCount(geojson.features?.length || 0);
    } catch {
      setData({ type: "FeatureCollection", features: [] });
      setPointCount(0);
    } finally {
      setLoading(false);
    }
  }, [range, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const centerOnUser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setViewState((v) => ({
          ...v,
          longitude: pos.coords.longitude,
          latitude: pos.coords.latitude,
          zoom: 14,
        }));
      },
      () => {},
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-[var(--bg-main)]">
      {/* Заголовок */}
      <div className="relative z-10 flex items-center gap-3 px-4 pt-3 pb-2 bg-[var(--bg-main)]/80 backdrop-blur-xl border-b border-[var(--border-color)]/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--text-primary)] leading-tight">Тепловая карта</h1>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              {loading ? "Загрузка..." : `${pointCount.toLocaleString("ru-RU")} точек активности`}
            </p>
          </div>
        </div>
      </div>

      {/* Карта */}
      <div className="flex-1 relative">
        <Map
          {...viewState}
          onMove={(e) => setViewState(e.viewState)}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {data && data.features.length > 0 && (
            <Source id="heatmap-data" type="geojson" data={data}>
              <Layer id="heatmap-layer" type="heatmap" paint={heatmapPaint} />
            </Source>
          )}
        </Map>

        {/* Кнопка геолокации */}
        <button
          onClick={centerOnUser}
          className="absolute top-3 right-14 w-8 h-8 rounded-lg glass-card flex items-center justify-center shadow-md active:scale-95 transition-transform"
        >
          <Crosshair className="w-4 h-4 text-[var(--text-primary)]" />
        </button>

        {/* Пустое состояние */}
        {!loading && pointCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="glass-card rounded-2xl p-6 text-center max-w-xs mx-4 pointer-events-auto">
              <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center mx-auto mb-3">
                <Flame className="w-6 h-6 text-[var(--accent-color)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Нет данных</p>
              <p className="text-xs text-[var(--text-muted)]">
                Проходите маршруты с включённым GPS, чтобы данные появились на тепловой карте
              </p>
            </div>
          </div>
        )}

        {/* Легенда */}
        <div className="absolute bottom-24 left-3 right-3 flex flex-col gap-2">
          {/* Градиент-легенда */}
          <div className="glass-card rounded-xl px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--text-muted)]">Мало</span>
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">Активность</span>
              <span className="text-[10px] text-[var(--text-muted)]">Много</span>
            </div>
            <div
              className="h-2 rounded-full"
              style={{
                background: "linear-gradient(to right, rgba(16,185,129,0.4), #22c55e, #facc15, #f97316, #ef4444, #dc2626)",
              }}
            />
          </div>

          {/* Фильтры */}
          <div className="flex gap-2">
            {/* Период */}
            <div className="glass-card rounded-xl px-2 py-1.5 flex gap-1 flex-1">
              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] mt-0.5 shrink-0" />
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`flex-1 text-[10px] rounded-lg px-1.5 py-1 font-medium transition-colors ${
                    range === r.key
                      ? "bg-[var(--accent-color)] text-white"
                      : "text-[var(--text-muted)] active:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Источник */}
            <div className="glass-card rounded-xl px-2 py-1.5 flex gap-1">
              {SOURCES.map((s) => {
                const Ic = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSource(s.key)}
                    title={s.label}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      source === s.key
                        ? "bg-[var(--accent-color)] text-white"
                        : "text-[var(--text-muted)] active:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <Ic className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
