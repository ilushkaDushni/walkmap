"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import useOfflineDownload from "@/hooks/useOfflineDownload";
import { buildRouteEvents, buildRouteEventsWithBranches, splitPathByCheckpoints, projectPointOnPath } from "@/lib/geo";
import { Download, Check, ChevronRight, ChevronLeft } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Ростов-на-Дону и окрестности
const ROSTOV_BOUNDS = [[38.8, 46.9], [40.6, 47.6]];

function Dot({ color, size = 14, label, pulse }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: "2px solid white",
        boxShadow: pulse
          ? `0 0 8px ${color}88`
          : "0 1px 4px rgba(0,0,0,.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontWeight: 700,
        color: "white",
        animation: pulse ? "pulse 2s infinite" : "none",
      }}
    >
      {label}
    </div>
  );
}

// Вычисление bounds маршрута
function useRouteBounds(route) {
  return useMemo(() => {
    const points = [];
    route.path?.forEach((p) => points.push([p.lng, p.lat]));
    route.checkpoints?.forEach((cp) => points.push([cp.position.lng, cp.position.lat]));
    if (route.finish?.position) points.push([route.finish.position.lng, route.finish.position.lat]);

    if (points.length < 2) return null;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of points) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    const PAD = 0.005;
    return [[minLng - PAD, minLat - PAD], [maxLng + PAD, maxLat + PAD]];
  }, [route]);
}

export default function RouteMapLeaflet({ route }) {
  const [started, setStarted] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [branchEventIndex, setBranchEventIndex] = useState(0);
  const mapRef = useRef(null);

  const { download, downloading, progress, done } = useOfflineDownload(route);
  const routeBounds = useRouteBounds(route);

  // Упорядоченные события маршрута (с ветками)
  const { mainEvents, branchEvents } = useMemo(() => {
    if (!route.path || route.path.length < 2) return { mainEvents: [], branchEvents: {} };
    if (route.branches?.length) {
      return buildRouteEventsWithBranches(route);
    }
    return {
      mainEvents: buildRouteEvents(route.path, route.checkpoints || [], route.segments || [], route.finish),
      branchEvents: {},
    };
  }, [route]);

  const events = activeBranchId ? (branchEvents[activeBranchId] || []) : mainEvents;
  const currentIdx = activeBranchId ? branchEventIndex : eventIndex;
  const currentEvent = events[currentIdx] || null;
  const isLast = currentIdx >= events.length - 1;

  const PATH_COLORS = ["#3b82f6", "#8b5cf6"];
  const pathSegmentsGeoJson = useMemo(() => {
    if (!route.path || route.path.length < 2) return null;
    const parts = splitPathByCheckpoints(route.path, route.checkpoints || []);
    const features = parts.map((segment, i) => ({
      type: "Feature",
      properties: { colorIndex: i % 2 },
      geometry: {
        type: "LineString",
        coordinates: segment.map((p) => [p.lng, p.lat]),
      },
    }));
    return { type: "FeatureCollection", features };
  }, [route.path, route.checkpoints]);

  // GeoJSON для веток (пунктир на карте просмотра)
  const branchesGeoJson = useMemo(() => {
    const branches = route.branches || [];
    if (branches.length === 0) return null;
    const features = branches
      .filter((b) => b.path?.length >= 2)
      .map((b) => ({
        type: "Feature",
        properties: { color: b.color || "#10b981" },
        geometry: {
          type: "LineString",
          coordinates: b.path.map((p) => [p.lng, p.lat]),
        },
      }));
    return features.length > 0 ? { type: "FeatureCollection", features } : null;
  }, [route.branches]);

  // Подсветка текущего отрезка — учитывает isDivider чекпоинты
  const activeSegmentGeoJson = useMemo(() => {
    if (!currentEvent || !started) return null;
    const path = route.path;
    if (currentEvent.type !== "segment") return null;

    const i = currentEvent.data.pathIndex;
    if (i < 0 || i >= path.length - 1) return null;

    const segStart = { lat: path[i].lat, lng: path[i].lng };
    const segEnd = { lat: path[i + 1].lat, lng: path[i + 1].lng };

    // Ищем isDivider чекпоинты на этом ребре
    const dividers = (route.checkpoints || []).filter((cp) => cp.isDivider);
    const splitsOnEdge = dividers
      .map((cp) => {
        const proj = projectPointOnPath(cp.position, path);
        return proj && proj.pathIndex === i ? proj : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.fraction - b.fraction);

    if (splitsOnEdge.length === 0) {
      // Нет разделителей — подсвечиваем весь отрезок
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[segStart.lng, segStart.lat], [segEnd.lng, segEnd.lat]],
        },
      };
    }

    // Подсвечиваем от начала ребра до первого разделителя
    const firstSplit = splitsOnEdge[0];
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [segStart.lng, segStart.lat],
          [firstSplit.position.lng, firstSplit.position.lat],
        ],
      },
    };
  }, [currentEvent, started, route.path, route.checkpoints]);

  // Подсветка после isDivider чекпоинта до конца ребра
  const activeAfterDividerGeoJson = useMemo(() => {
    if (!currentEvent || !started) return null;
    if (currentEvent.type !== "checkpoint" || !currentEvent.data.isDivider) return null;
    const path = route.path;
    const proj = projectPointOnPath(currentEvent.data.position, path);
    if (!proj) return null;
    const i = proj.pathIndex;
    if (i < 0 || i >= path.length - 1) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [proj.position.lng, proj.position.lat],
          [path[i + 1].lng, path[i + 1].lat],
        ],
      },
    };
  }, [currentEvent, started, route.path]);

  const center = route.mapCenter || { lat: 47.2357, lng: 39.7015 };
  const zoom = route.mapZoom || 14;

  const onLoad = useCallback((e) => {
    mapRef.current = e.target;
  }, []);

  const handleStart = () => {
    setStarted(true);
  };

  const handleNext = () => {
    if (activeBranchId) {
      // На ветке
      const bEvents = branchEvents[activeBranchId] || [];
      const nextBranchEvent = bEvents[branchEventIndex + 1];
      if (nextBranchEvent?.type === "merge") {
        // Возвращаемся на main
        setActiveBranchId(null);
        // Находим следующее событие после fork
        const forkIdx = mainEvents.findIndex((e) => e.type === "fork" && e.data.id === activeBranchId);
        if (forkIdx >= 0 && forkIdx + 1 < mainEvents.length) {
          setEventIndex(forkIdx + 1);
        }
        setBranchEventIndex(0);
        return;
      }
      if (branchEventIndex < bEvents.length - 1) {
        setBranchEventIndex((i) => i + 1);
      }
    } else {
      if (!isLast) setEventIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (activeBranchId) {
      if (branchEventIndex > 0) setBranchEventIndex((i) => i - 1);
      else {
        // Возвращаемся к fork на main
        setActiveBranchId(null);
        setBranchEventIndex(0);
      }
    } else {
      if (eventIndex > 0) setEventIndex((i) => i - 1);
    }
  };

  // Выбор ветки на fork
  const handleChooseBranch = (branchId) => {
    setActiveBranchId(branchId);
    setBranchEventIndex(0);
  };

  const handleStayMain = () => {
    // Просто идём дальше по main
    setEventIndex((i) => i + 1);
  };

  return (
    <div className="space-y-4">
      {/* Карта */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-sm">
        <Map
          onLoad={onLoad}
          initialViewState={
            routeBounds
              ? { bounds: routeBounds, fitBoundsOptions: { padding: 40 } }
              : { longitude: center.lng, latitude: center.lat, zoom }
          }
          maxBounds={ROSTOV_BOUNDS}
          minZoom={10}
          style={{ height: started ? "350px" : "300px", width: "100%" }}
          mapStyle={STYLE}
          attributionControl={true}
        >
          {/* Путь — чередующиеся цвета по чекпоинтам */}
          {pathSegmentsGeoJson && (
            <Source id="route-path" type="geojson" data={pathSegmentsGeoJson}>
              <Layer
                id="route-path-line-0"
                type="line"
                filter={["==", ["get", "colorIndex"], 0]}
                paint={{
                  "line-color": PATH_COLORS[0],
                  "line-width": 3,
                  "line-opacity": 0.8,
                }}
              />
              <Layer
                id="route-path-line-1"
                type="line"
                filter={["==", ["get", "colorIndex"], 1]}
                paint={{
                  "line-color": PATH_COLORS[1],
                  "line-width": 3,
                  "line-opacity": 0.8,
                }}
              />
            </Source>
          )}

          {/* Ветки — пунктир */}
          {branchesGeoJson && (
            <Source id="branches-view" type="geojson" data={branchesGeoJson}>
              <Layer
                id="branches-view-line"
                type="line"
                paint={{
                  "line-color": ["get", "color"],
                  "line-width": 3,
                  "line-opacity": 0.5,
                  "line-dasharray": [4, 3],
                }}
              />
            </Source>
          )}

          {/* Fork маркеры */}
          {(route.branches || []).map((branch) =>
            branch.fork?.position ? (
              <Marker
                key={`fork-${branch.id}`}
                longitude={branch.fork.position.lng}
                latitude={branch.fork.position.lat}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    background: branch.color || "#10b981",
                    border: "2px solid white",
                    boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                    transform: "rotate(45deg)",
                  }}
                />
              </Marker>
            ) : null
          )}

          {/* Подсветка активного отрезка */}
          {activeSegmentGeoJson && (
            <Source id="active-segment" type="geojson" data={activeSegmentGeoJson}>
              <Layer
                id="active-segment-line"
                type="line"
                paint={{
                  "line-color": "#f97316",
                  "line-width": 6,
                  "line-opacity": 1,
                }}
              />
            </Source>
          )}

          {/* Подсветка после isDivider чекпоинта */}
          {activeAfterDividerGeoJson && (
            <Source id="active-after-divider" type="geojson" data={activeAfterDividerGeoJson}>
              <Layer
                id="active-after-divider-line"
                type="line"
                paint={{
                  "line-color": "#f97316",
                  "line-width": 6,
                  "line-opacity": 1,
                }}
              />
            </Source>
          )}

          {/* Чекпоинты — скрываем isEmpty и transparent для пользователя */}
          {route.checkpoints?.filter((cp) => !cp.isEmpty && cp.color !== "transparent").map((cp) => {
            const isActive = started && currentEvent?.type === "checkpoint" && currentEvent.data.id === cp.id;
            return (
              <Marker
                key={cp.id}
                longitude={cp.position.lng}
                latitude={cp.position.lat}
              >
                <Dot
                  color={isActive ? "#ef4444" : (cp.color || "#f59e0b")}
                  size={isActive ? 18 : 14}
                  label={cp.order + 1}
                  pulse={isActive}
                />
              </Marker>
            );
          })}

          {/* Финиш — шахматный флаг */}
          {route.finish?.position && (
            <Marker
              longitude={route.finish.position.lng}
              latitude={route.finish.position.lat}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  background: "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 10px 10px",
                  border: "2px solid white",
                  boxShadow: started && currentEvent?.type === "finish"
                    ? "0 0 10px #ef444488"
                    : "0 1px 4px rgba(0,0,0,.3)",
                  animation: started && currentEvent?.type === "finish" ? "pulse 2s infinite" : "none",
                }}
              />
            </Marker>
          )}
        </Map>
      </div>

      {/* До начала */}
      {!started && (
        <>
          {/* GPS + Оффлайн */}
          <div className="flex gap-2">
            <button
              disabled
              className="flex-1 rounded-xl px-4 py-3 text-sm font-medium border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"
            >
              GPS (скоро)
            </button>

            <button
              onClick={download}
              disabled={downloading || done}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              {done ? (
                <><Check className="h-4 w-4 text-green-600" /> Готово</>
              ) : downloading ? (
                <>{progress}%</>
              ) : (
                <><Download className="h-4 w-4" /> Оффлайн</>
              )}
            </button>
          </div>

          {/* Intro текст + аудио маршрута */}
          {(route.intro || route.audio?.length > 0) && (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{route.title}</h2>
              {route.intro && (
                <div className="max-h-[40vh] overflow-y-auto scrollbar-thin text-base leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                  {route.intro}
                </div>
              )}
              {route.audio?.length > 0 && (
                <AudioPlayer urls={route.audio} variant="full" />
              )}
            </div>
          )}

          {/* Кнопка "Начать маршрут" */}
          <button
            onClick={handleStart}
            className="w-full rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-green-700 active:bg-green-800"
          >
            Начать маршрут
          </button>
        </>
      )}

      {/* После начала — пошаговый просмотр */}
      {started && (
        <>
          {/* Карточка текущего события */}
          {currentEvent && (
            <div
              key={eventIndex}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3 animate-[fadeIn_0.7s_ease]"
            >
              {/* Сегмент (текст пути) */}
              {currentEvent.type === "segment" && (
                <>
                  {currentEvent.data.title && (
                    <h3 className="text-base font-bold text-[var(--text-primary)] text-center">
                      {currentEvent.data.title}
                    </h3>
                  )}
                  {currentEvent.data.text && (
                    <div className="max-h-[40vh] overflow-y-auto scrollbar-thin text-base leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                      {currentEvent.data.text}
                    </div>
                  )}
                  {currentEvent.data.photos?.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {currentEvent.data.photos.map((url, i) => (
                        <img key={i} src={url} alt="" className="h-32 rounded-xl object-cover shrink-0" />
                      ))}
                    </div>
                  )}
                  {currentEvent.data.audio?.length > 0 && (
                    <AudioPlayer
                      key={`seg-${eventIndex}`}
                      urls={currentEvent.data.audio}
                      autoPlay
                      variant="full"
                    />
                  )}
                </>
              )}

              {/* Чекпоинт */}
              {currentEvent.type === "checkpoint" && (
                currentEvent.data.isEmpty ? (
                  <p className="text-sm font-medium text-[var(--text-muted)] text-center py-2">
                    Раздел #{currentEvent.data.order + 1}
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {currentEvent.data.color !== "transparent" && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: currentEvent.data.color || "#f59e0b" }}>
                          {currentEvent.data.order + 1}
                        </div>
                      )}
                      <h3 className="text-base font-bold text-[var(--text-primary)]">
                        {currentEvent.data.title || `Точка #${currentEvent.data.order + 1}`}
                      </h3>
                    </div>
                    {currentEvent.data.description && (
                      <div className="max-h-[40vh] overflow-y-auto scrollbar-thin text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                        {currentEvent.data.description}
                      </div>
                    )}
                    {currentEvent.data.photos?.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {currentEvent.data.photos.map((url, i) => (
                          <img key={i} src={url} alt="" className="h-32 rounded-xl object-cover shrink-0" />
                        ))}
                      </div>
                    )}
                    {currentEvent.data.audio?.length > 0 && (
                      <AudioPlayer
                        key={`cp-${eventIndex}`}
                        urls={currentEvent.data.audio}
                        autoPlay
                        variant="full"
                      />
                    )}
                    {currentEvent.data.coinsReward > 0 && (
                      <p className="text-sm font-medium text-amber-600">
                        +{currentEvent.data.coinsReward} монет
                      </p>
                    )}
                  </>
                )
              )}

              {/* Финиш */}
              {currentEvent.type === "finish" && (
                <div className="text-center py-2">
                  <p className="text-lg font-bold text-green-600">Маршрут пройден!</p>
                  {currentEvent.data.coinsReward > 0 && (
                    <p className="mt-1 text-sm text-green-600">
                      +{currentEvent.data.coinsReward} монет за финиш
                    </p>
                  )}
                </div>
              )}

              {/* Fork — выбор пути */}
              {currentEvent.type === "fork" && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[var(--text-primary)] text-center">
                    Развилка
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] text-center">
                    Выберите путь:
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleStayMain}
                      className="w-full rounded-xl border border-blue-500 px-4 py-3 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                    >
                      Основной маршрут
                    </button>
                    <button
                      onClick={() => handleChooseBranch(currentEvent.data.id)}
                      className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                      style={{ background: currentEvent.data.color || "#10b981" }}
                    >
                      {currentEvent.data.name || "Ветка"}
                    </button>
                  </div>
                </div>
              )}

              {/* Merge — возврат к основному пути */}
              {currentEvent.type === "merge" && (
                <div className="text-center py-2">
                  <p className="text-sm text-[var(--text-muted)]">Возврат к основному маршруту</p>
                </div>
              )}
            </div>
          )}

          {/* Навигация */}
          {events.length > 0 && currentEvent?.type !== "fork" && (
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={currentIdx === 0 && !activeBranchId}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-30"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <span className="text-xs text-[var(--text-muted)]">
                {activeBranchId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] mr-1">
                    ветка
                  </span>
                )}
                {currentIdx + 1} / {events.length}
              </span>

              <button
                onClick={handleNext}
                disabled={isLast}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white transition hover:bg-green-700 disabled:opacity-30"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
