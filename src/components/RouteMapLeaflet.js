"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import useOfflineDownload from "@/hooks/useOfflineDownload";
import useGpsNavigation from "@/hooks/useGpsNavigation";
import useNotification from "@/hooks/useNotification";
import { useUser } from "@/components/UserProvider";
import { buildRouteEvents, splitPathByCheckpoints, projectPointOnPath } from "@/lib/geo";
import { Download, Check, ChevronRight, ChevronLeft, Navigation, Locate, X } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ROSTOV_BOUNDS = [[38.8, 46.9], [40.6, 47.6]];
const CAMERA_THROTTLE_MS = 1000; // обновлять камеру не чаще чем раз в 1с

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

function accuracyCircleGeoJson(center, radiusMeters) {
  if (!center || radiusMeters <= 10) return null;
  const points = 32;
  const coords = [];
  const km = radiusMeters / 1000;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dlat = (km / 111.32) * Math.cos(angle);
    const dlng = (km / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([center.lng + dlng, center.lat + dlat]);
  }
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

export default function RouteMapLeaflet({ route }) {
  const [started, setStarted] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const mapRef = useRef(null);

  // GPS
  const [gpsMode, setGpsMode] = useState(null); // null | gps_requesting | gps_active | gps_finished
  const [gpsError, setGpsError] = useState(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [completeSent, setCompleteSent] = useState(false);
  const userDragRef = useRef(false);
  const dashStepRef = useRef(0);
  const dashIntervalRef = useRef(null);
  const lastCameraRef = useRef(0);

  const { authFetch, user } = useUser();
  const { download, downloading, progress: dlProgress, done } = useOfflineDownload(route);
  const routeBounds = useRouteBounds(route);
  const { requestPermission, notify } = useNotification();

  const handleCheckpointNotification = useCallback((checkpoint, dist) => {
    notify(checkpoint.title || "Контрольная точка", {
      body: `До точки ${dist} м`,
      tag: `checkpoint-${checkpoint.id}`,
    });
  }, [notify]);

  const handleFinishNotification = useCallback(() => {
    notify("Финиш рядом!", {
      body: "Вы почти дошли до конца маршрута",
      tag: "finish",
    });
  }, [notify]);

  const gps = useGpsNavigation({
    route,
    active: gpsMode === "gps_active",
    onCheckpointTriggered: handleCheckpointNotification,
    onFinishTriggered: handleFinishNotification,
  });

  // === GPS state machine ===
  useEffect(() => {
    if (gpsMode !== "gps_requesting") return;
    if (gps.gpsStatus === "watching" && gps.position) {
      setGpsMode("gps_active");
      setGpsError(null);
    } else if (gps.gpsStatus === "denied") {
      setGpsMode(null);
      setGpsError("Доступ к GPS запрещён. Разрешите геолокацию в настройках браузера.");
    } else if (gps.gpsStatus === "unavailable") {
      setGpsMode(null);
      setGpsError("GPS недоступен на этом устройстве.");
    } else if (gps.gpsStatus === "error") {
      setGpsMode(null);
      setGpsError("Ошибка GPS. Попробуйте ещё раз.");
    }
  }, [gpsMode, gps.gpsStatus, gps.position]);

  // === Плавное следование камеры (throttled) ===
  useEffect(() => {
    if (gpsMode !== "gps_active" || !gps.position || !autoFollow) return;
    const map = mapRef.current;
    if (!map) return;
    const now = Date.now();
    if (now - lastCameraRef.current < CAMERA_THROTTLE_MS) return;
    lastCameraRef.current = now;
    map.easeTo({ center: [gps.position.lng, gps.position.lat], zoom: 17, duration: 1000 });
  }, [gpsMode, gps.position, autoFollow]);

  // === Анимация пунктирной линии (preview + GPS) ===
  useEffect(() => {
    // Анимируем в preview (gpsMode === null) и в GPS-режиме
    if (gpsMode !== null && gpsMode !== "gps_active") {
      if (dashIntervalRef.current) {
        clearInterval(dashIntervalRef.current);
        dashIntervalRef.current = null;
      }
      return;
    }
    const patterns = [[0, 4, 3], [1, 4, 2], [2, 4, 1], [3, 4, 0]];
    dashIntervalRef.current = setInterval(() => {
      const map = mapRef.current;
      if (!map) return;
      dashStepRef.current = (dashStepRef.current + 1) % patterns.length;
      try {
        if (map.getLayer("route-path-animated")) {
          map.setPaintProperty("route-path-animated", "line-dasharray", patterns[dashStepRef.current]);
        }
        if (map.getLayer("remaining-route-animated")) {
          map.setPaintProperty("remaining-route-animated", "line-dasharray", patterns[dashStepRef.current]);
        }
      } catch { /* layer может ещё не существовать */ }
    }, 100);
    return () => {
      clearInterval(dashIntervalRef.current);
      dashIntervalRef.current = null;
    };
  }, [gpsMode]);

  // === Финиш GPS ===
  useEffect(() => {
    if (gpsMode !== "gps_active" || !gps.finishReached) return;
    setGpsMode("gps_finished");
  }, [gpsMode, gps.finishReached]);

  // === Запись прохождения ===
  useEffect(() => {
    if (gpsMode !== "gps_finished" || completeSent || !user) return;
    setCompleteSent(true);
    authFetch(`/api/routes/${route._id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coins: gps.totalCoins, gpsVerified: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.newAchievements?.length > 0) {
          window.dispatchEvent(new CustomEvent("achievement-unlocked", {
            detail: { slugs: data.newAchievements, rewardCoins: data.achievementRewardCoins },
          }));
        }
      })
      .catch(() => {});
  }, [gpsMode, completeSent, user, authFetch, route._id, gps.totalCoins]);

  // === Events (manual mode) ===
  const events = useMemo(() => {
    if (!route.path || route.path.length < 2) return [];
    return buildRouteEvents(route.path, route.checkpoints || [], route.segments || [], route.finish);
  }, [route]);

  const currentEvent = events[eventIndex] || null;
  const isLast = eventIndex >= events.length - 1;

  // === GPS auto-advance: когда GPS триггерит чекпоинт/сегмент, переключаем карточку ===
  useEffect(() => {
    if (!gps.activeCheckpoint || !started) return;
    const idx = events.findIndex(
      (e) => e.type === "checkpoint" && e.data.id === gps.activeCheckpoint.id
    );
    if (idx >= 0 && idx !== eventIndex) {
      setEventIndex(idx);
    }
  }, [gps.activeCheckpoint, started, events, eventIndex]);

  useEffect(() => {
    if (!gps.activeSegment || !started) return;
    const idx = events.findIndex(
      (e) => e.type === "segment" && e.data.id === gps.activeSegment.id
    );
    if (idx >= 0 && idx !== eventIndex) {
      setEventIndex(idx);
    }
  }, [gps.activeSegment, started, events, eventIndex]);

  // При GPS-финише переключаемся на финишную карточку
  useEffect(() => {
    if (gpsMode !== "gps_finished" || !started) return;
    const idx = events.findIndex((e) => e.type === "finish");
    if (idx >= 0) {
      setEventIndex(idx);
    }
  }, [gpsMode, started, events]);

  // === GeoJSON (manual mode layers) ===
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

  // GeoJSON для цветных сегментов
  const coloredSegmentsGeoJson = useMemo(() => {
    const path = route.path;
    const segments = route.segments || [];
    if (!path || path.length < 2 || segments.length === 0) return null;
    const features = [];
    for (const seg of segments) {
      if (!seg.color || seg.pathIndex == null) continue;
      const i = seg.pathIndex;
      if (i >= path.length - 1) continue;
      features.push({
        type: "Feature",
        properties: { color: seg.color },
        geometry: {
          type: "LineString",
          coordinates: [[path[i].lng, path[i].lat], [path[i + 1].lng, path[i + 1].lat]],
        },
      });
    }
    if (features.length === 0) return null;
    return { type: "FeatureCollection", features };
  }, [route.path, route.segments]);

  const activeSegmentGeoJson = useMemo(() => {
    if (!currentEvent || !started || gpsMode === "gps_active") return null;
    const path = route.path;
    if (currentEvent.type !== "segment") return null;
    const i = currentEvent.data.pathIndex;
    if (i == null || i < 0 || i >= path.length - 1) return null;
    const segStart = { lat: path[i].lat, lng: path[i].lng };
    const segEnd = { lat: path[i + 1].lat, lng: path[i + 1].lng };
    const dividers = (route.checkpoints || []).filter((cp) => cp.isDivider);
    const splitsOnEdge = dividers
      .map((cp) => {
        const proj = projectPointOnPath(cp.position, path);
        return proj && proj.pathIndex === i ? proj : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.fraction - b.fraction);
    if (splitsOnEdge.length === 0) {
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[segStart.lng, segStart.lat], [segEnd.lng, segEnd.lat]],
        },
      };
    }
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
  }, [currentEvent, started, gpsMode, route.path, route.checkpoints]);

  const activeAfterDividerGeoJson = useMemo(() => {
    if (!currentEvent || !started || gpsMode === "gps_active") return null;
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
  }, [currentEvent, started, gpsMode, route.path]);

  const accuracyGeoJson = useMemo(() => {
    if (gpsMode !== "gps_active" || !gps.position) return null;
    return accuracyCircleGeoJson(gps.position, gps.accuracy || 0);
  }, [gpsMode, gps.position, gps.accuracy]);

  const center = route.mapCenter || { lat: 47.2357, lng: 39.7015 };
  const zoom = route.mapZoom || 14;

  const onLoad = useCallback((e) => {
    mapRef.current = e.target;
  }, []);

  const onMoveStart = useCallback((e) => {
    if (e.originalEvent && gpsMode === "gps_active") {
      userDragRef.current = true;
      setAutoFollow(false);
    }
  }, [gpsMode]);

  const handleRecenter = useCallback(() => {
    setAutoFollow(true);
    userDragRef.current = false;
    if (gps.position && mapRef.current) {
      lastCameraRef.current = Date.now();
      mapRef.current.easeTo({ center: [gps.position.lng, gps.position.lat], zoom: 17, duration: 1000 });
    }
  }, [gps.position]);

  // === "Начать маршрут" запускает GPS + ручной режим одновременно ===
  const handleStart = () => {
    setStarted(true);
    setGpsError(null);
    setGpsMode("gps_requesting");
    setAutoFollow(true);
    setCompleteSent(false);
    userDragRef.current = false;
    lastCameraRef.current = 0;
    gps.startGps();
    requestPermission();
  };

  const handleStopGps = () => {
    gps.stopGps();
    setGpsMode(null);
    setGpsError(null);
    setAutoFollow(true);
    setCompleteSent(false);
    userDragRef.current = false;
    // started остаётся true — ручной режим работает
  };

  const handleNext = () => {
    if (!isLast) setEventIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (eventIndex > 0) setEventIndex((i) => i - 1);
  };

  const isGpsOverlay = gpsMode === "gps_active" || gpsMode === "gps_finished";

  return (
    <div className="space-y-4">
      {/* Карта */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-sm relative">
        <Map
          onLoad={onLoad}
          onMoveStart={onMoveStart}
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
          {/* Обычный путь (скрываем когда GPS overlay показывает passed/remaining) */}
          {!isGpsOverlay && pathSegmentsGeoJson && (
            <Source id="route-path" type="geojson" data={pathSegmentsGeoJson}>
              <Layer
                id="route-path-line-0"
                type="line"
                filter={["==", ["get", "colorIndex"], 0]}
                paint={{ "line-color": PATH_COLORS[0], "line-width": 3, "line-opacity": 0.8 }}
              />
              <Layer
                id="route-path-line-1"
                type="line"
                filter={["==", ["get", "colorIndex"], 1]}
                paint={{ "line-color": PATH_COLORS[1], "line-width": 3, "line-opacity": 0.8 }}
              />
              {/* Анимированный пунктир поверх линий */}
              <Layer
                id="route-path-animated"
                type="line"
                paint={{
                  "line-color": "#ffffff",
                  "line-width": 3,
                  "line-opacity": 0.4,
                  "line-dasharray": [0, 4, 3],
                }}
              />
            </Source>
          )}

          {/* Цветные сегменты поверх базового пути */}
          {!isGpsOverlay && coloredSegmentsGeoJson && (
            <Source id="colored-segments" type="geojson" data={coloredSegmentsGeoJson}>
              <Layer
                id="colored-segments-line"
                type="line"
                paint={{
                  "line-color": ["get", "color"],
                  "line-width": 4,
                  "line-opacity": 0.9,
                }}
              />
            </Source>
          )}

          {/* GPS: пройденный путь (серый) */}
          {isGpsOverlay && gps.passedGeoJson && (
            <Source id="passed-route" type="geojson" data={gps.passedGeoJson}>
              <Layer id="passed-route-line" type="line"
                paint={{ "line-color": "#808080", "line-width": 4, "line-opacity": 0.5 }} />
            </Source>
          )}

          {/* GPS: оставшийся путь (анимированные пунктиры) */}
          {isGpsOverlay && gps.remainingGeoJson && (
            <Source id="remaining-route" type="geojson" data={gps.remainingGeoJson}>
              <Layer id="remaining-route-base" type="line"
                paint={{ "line-color": "#3b82f6", "line-width": 4, "line-opacity": 0.3 }} />
              <Layer id="remaining-route-animated" type="line"
                paint={{ "line-color": "#3b82f6", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [0, 4, 3] }} />
            </Source>
          )}

          {/* GPS: круг точности */}
          {isGpsOverlay && accuracyGeoJson && (
            <Source id="accuracy-circle" type="geojson" data={accuracyGeoJson}>
              <Layer id="accuracy-circle-fill" type="fill"
                paint={{ "fill-color": "#4285f4", "fill-opacity": 0.1 }} />
              <Layer id="accuracy-circle-border" type="line"
                paint={{ "line-color": "#4285f4", "line-opacity": 0.3, "line-width": 1 }} />
            </Source>
          )}

          {/* Подсветка активного отрезка (только без GPS overlay) */}
          {activeSegmentGeoJson && (
            <Source id="active-segment" type="geojson" data={activeSegmentGeoJson}>
              <Layer id="active-segment-line" type="line"
                paint={{ "line-color": "#f97316", "line-width": 6, "line-opacity": 1 }} />
            </Source>
          )}
          {activeAfterDividerGeoJson && (
            <Source id="active-after-divider" type="geojson" data={activeAfterDividerGeoJson}>
              <Layer id="active-after-divider-line" type="line"
                paint={{ "line-color": "#f97316", "line-width": 6, "line-opacity": 1 }} />
            </Source>
          )}

          {/* Чекпоинты */}
          {route.checkpoints?.filter((cp) => !cp.isEmpty && cp.color !== "transparent").map((cp) => {
            const isTriggeredGps = isGpsOverlay && gps.triggeredIds.has(cp.id);
            const isActive = started && currentEvent?.type === "checkpoint" && currentEvent.data.id === cp.id;
            const color = isTriggeredGps
              ? "#22c55e"
              : isActive ? "#ef4444" : (cp.color || "#f59e0b");
            const label = isTriggeredGps ? "✓" : (cp.order + 1);
            const size = isActive ? 18 : 14;
            return (
              <Marker key={cp.id} longitude={cp.position.lng} latitude={cp.position.lat}>
                <Dot color={color} size={size} label={label} pulse={isActive} />
              </Marker>
            );
          })}

          {/* Финиш */}
          {route.finish?.position && (
            <Marker longitude={route.finish.position.lng} latitude={route.finish.position.lat}>
              <div style={{
                width: 20, height: 20, borderRadius: 3,
                background: "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 10px 10px",
                border: "2px solid white",
                boxShadow: (started && currentEvent?.type === "finish") || gpsMode === "gps_finished"
                  ? "0 0 10px #ef444488" : "0 1px 4px rgba(0,0,0,.3)",
                animation: (started && currentEvent?.type === "finish") || gpsMode === "gps_finished"
                  ? "pulse 2s infinite" : "none",
              }} />
            </Marker>
          )}

          {/* GPS: маркер пользователя */}
          {isGpsOverlay && gps.position && (
            <Marker longitude={gps.position.lng} latitude={gps.position.lat}>
              <div className="gps-dot">
                <div className="gps-dot-pulse" />
                <div className="gps-dot-core" />
              </div>
            </Marker>
          )}
        </Map>

        {/* Кнопка перецентрировать */}
        {isGpsOverlay && !autoFollow && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 text-blue-600 hover:bg-gray-50 transition"
          >
            <Locate className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* === PREVIEW (до начала) === */}
      {!started && !gpsMode && (
        <>
          {/* Оффлайн */}
          <div className="flex gap-2">
            <button
              onClick={download}
              disabled={downloading || done}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-50"
            >
              {done ? (
                <><Check className="h-4 w-4 text-green-600" /> Готово</>
              ) : downloading ? (
                <>{dlProgress}%</>
              ) : (
                <><Download className="h-4 w-4" /> Оффлайн</>
              )}
            </button>
          </div>

          {/* GPS ошибка */}
          {gpsError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{gpsError}</span>
            </div>
          )}

          {/* Intro */}
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

          {/* Кнопка старт — запускает GPS + маршрут */}
          <button
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-green-700 active:bg-green-800"
          >
            <Navigation className="h-5 w-5" />
            Начать маршрут
          </button>
        </>
      )}

      {/* === GPS REQUESTING === */}
      {gpsMode === "gps_requesting" && !gps.position && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Navigation className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-medium">Определяем местоположение...</span>
          </div>
          <button
            onClick={handleStopGps}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
          >
            Продолжить без GPS
          </button>
        </div>
      )}

      {/* === GPS панель (прогресс + предупреждения) === */}
      {gpsMode === "gps_active" && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-2">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>{Math.round(gps.progress * 100)}%</span>
              <span>{gps.distanceRemaining > 1000
                ? `${(gps.distanceRemaining / 1000).toFixed(1)} км`
                : `${Math.round(gps.distanceRemaining)} м`
              }</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                style={{ width: `${Math.round(gps.progress * 100)}%` }}
              />
            </div>
          </div>
          {gps.isOffRoute && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 text-center">
              Вы отклонились от маршрута
            </div>
          )}
          {gps.accuracy > 100 && (
            <p className="text-[10px] text-[var(--text-muted)] text-center">
              Низкая точность GPS ({Math.round(gps.accuracy)}м)
            </p>
          )}
          <button
            onClick={handleStopGps}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-300 px-4 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5" />
            Остановить GPS
          </button>
        </div>
      )}

      {/* === GPS FINISHED === */}
      {gpsMode === "gps_finished" && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 text-center space-y-3 animate-slide-up">
          <p className="text-lg font-bold text-green-600">Маршрут пройден!</p>
          {gps.totalCoins > 0 && (
            <p className="text-sm text-green-600">+{gps.totalCoins} монет</p>
          )}
          <div className="flex gap-2 justify-center">
            <a
              href="/routes"
              className="inline-block rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              К маршрутам
            </a>
            <button
              onClick={handleStopGps}
              className="rounded-xl border border-[var(--border-color)] px-6 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* === Карточки событий + навигация (всегда после старта) === */}
      {started && gpsMode !== "gps_finished" && (
        <>
          {currentEvent && (
            <div
              key={`main-${eventIndex}`}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3 animate-[fadeIn_0.7s_ease]"
            >
              {/* Сегмент */}
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
                    <AudioPlayer key={`seg-${eventIndex}`} urls={currentEvent.data.audio} autoPlay variant="full" />
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
                      <AudioPlayer key={`cp-${eventIndex}`} urls={currentEvent.data.audio} autoPlay variant="full" />
                    )}
                    {currentEvent.data.coinsReward > 0 && (
                      <p className="text-sm font-medium text-amber-600">+{currentEvent.data.coinsReward} монет</p>
                    )}
                  </>
                )
              )}

              {/* Финиш */}
              {currentEvent.type === "finish" && (
                <div className="text-center py-2 space-y-3">
                  <p className="text-lg font-bold text-green-600">Маршрут пройден!</p>
                  {currentEvent.data.coinsReward > 0 && (
                    <p className="text-sm text-green-600">+{currentEvent.data.coinsReward} монет за финиш</p>
                  )}
                  <a href="/routes" className="inline-block rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700">
                    Выйти
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Навигация Вперёд/Назад */}
          {events.length > 0 && (
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={eventIndex === 0}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-30"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                {eventIndex + 1} / {events.length}
              </span>
              {gpsMode === "gps_active" ? (
                <div className="h-12 w-12" />
              ) : (
                <button
                  onClick={handleNext}
                  disabled={isLast}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white transition hover:bg-green-700 disabled:opacity-30"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
