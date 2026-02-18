"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import useOfflineDownload from "@/hooks/useOfflineDownload";
import useGpsNavigation from "@/hooks/useGpsNavigation";
import useNotification from "@/hooks/useNotification";
import useAudioPlayer from "@/hooks/useAudioPlayer";
import { useUser } from "@/components/UserProvider";
import { buildRouteEvents, splitPathByCheckpoints, projectPointOnPath, getDirectedPath, remapSegmentsForDirectedPath, haversineDistance } from "@/lib/geo";
import { Download, Check, ChevronRight, ChevronLeft, Navigation, Locate, X, Volume2 } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ROSTOV_BOUNDS = [[38.8, 46.9], [40.6, 47.6]];
const CAMERA_THROTTLE_MS = 1000;
const SHEET_COLLAPSED = 100;
const SHEET_MAX_RATIO = 0.6;

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

// === Voice button for bottom sheet ===
function VoiceButton({ audioUrls }) {
  const hasAudio = audioUrls && audioUrls.length > 0;
  const { isPlaying, togglePlay } = useAudioPlayer({ urls: hasAudio ? audioUrls : [] });
  const [toast, setToast] = useState(false);

  const handleClick = () => {
    if (hasAudio) {
      togglePlay();
    } else {
      setToast(true);
      setTimeout(() => setToast(false), 1500);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
          hasAudio
            ? isPlaying
              ? "bg-green-600 text-white"
              : "bg-green-600/20 text-green-600"
            : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
        }`}
      >
        <Volume2 className="h-4 w-4" />
      </button>
      {toast && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg bg-black/80 px-3 py-1.5 text-xs text-white">
          Нет озвучки
        </div>
      )}
    </div>
  );
}

// === Bottom Sheet ===
function BottomSheet({ children, expanded, onToggle }) {
  const sheetRef = useRef(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const isDraggingRef = useRef(false);

  const maxHeight = typeof window !== "undefined" ? window.innerHeight * SHEET_MAX_RATIO : 400;

  const handleTouchStart = (e) => {
    if (e.target.closest("button, a, input, .no-drag")) return;
    isDraggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    startHeightRef.current = expanded ? maxHeight : SHEET_COLLAPSED;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const dy = startYRef.current - e.touches[0].clientY;
    const newH = Math.max(SHEET_COLLAPSED, Math.min(maxHeight, startHeightRef.current + dy));
    if (sheetRef.current) {
      sheetRef.current.style.height = `${newH}px`;
      sheetRef.current.style.transition = "none";
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (!sheetRef.current) return;
    const h = sheetRef.current.offsetHeight;
    const threshold = (SHEET_COLLAPSED + maxHeight) / 2;
    sheetRef.current.style.transition = "height 0.3s ease";
    if (h > threshold) {
      sheetRef.current.style.height = `${maxHeight}px`;
      if (!expanded) onToggle();
    } else {
      sheetRef.current.style.height = `${SHEET_COLLAPSED}px`;
      if (expanded) onToggle();
    }
  };

  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transition = "height 0.3s ease";
      sheetRef.current.style.height = expanded ? `${maxHeight}px` : `${SHEET_COLLAPSED}px`;
    }
  }, [expanded, maxHeight]);

  return (
    <div
      ref={sheetRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="absolute bottom-0 left-0 right-0 z-20 rounded-t-2xl bg-[var(--bg-surface)] shadow-[0_-4px_20px_rgba(0,0,0,0.15)] overflow-hidden"
      style={{ height: SHEET_COLLAPSED }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center pt-2 pb-1 cursor-grab"
        onClick={onToggle}
      >
        <div className="h-1 w-10 rounded-full bg-[var(--text-muted)] opacity-40" />
      </div>
      <div className="h-[calc(100%-16px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export default function RouteMapLeaflet({ route }) {
  const [started, setStarted] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  const mapRef = useRef(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // GPS
  const [gpsMode, setGpsMode] = useState(null); // null | gps_requesting | gps_active | gps_finished
  const [gpsError, setGpsError] = useState(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [completeSent, setCompleteSent] = useState(false);
  const userDragRef = useRef(false);
  const dashAnimRef = useRef(null);
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

  // === Анимация «змейки» ===
  useEffect(() => {
    if (gpsMode !== null && gpsMode !== "gps_active") {
      if (dashAnimRef.current) {
        cancelAnimationFrame(dashAnimRef.current);
        dashAnimRef.current = null;
      }
      return;
    }
    if (dirPath.length < 2) return;
    const cumDist = [0];
    for (let i = 1; i < dirPath.length; i++)
      cumDist.push(cumDist[i - 1] + haversineDistance(dirPath[i - 1], dirPath[i]));
    const total = cumDist[cumDist.length - 1];
    if (total === 0) return;

    const SNAKE = 0.04, PERIOD = 0.12, SPEED = 0.08;
    let progress = 0, prevTime = 0;

    const sliceSegment = (tailDist, headDist) => {
      const coords = [];
      let tailDone = false;
      for (let i = 0; i < dirPath.length - 1; i++) {
        const d0 = cumDist[i], d1 = cumDist[i + 1];
        if (d1 - d0 === 0) continue;
        if (!tailDone && d1 >= tailDist) {
          const t = (tailDist - d0) / (d1 - d0);
          coords.push([
            dirPath[i].lng + t * (dirPath[i + 1].lng - dirPath[i].lng),
            dirPath[i].lat + t * (dirPath[i + 1].lat - dirPath[i].lat),
          ]);
          tailDone = true;
        }
        if (tailDone) {
          if (d1 <= headDist) coords.push([dirPath[i + 1].lng, dirPath[i + 1].lat]);
          if (d1 >= headDist) {
            const t = (headDist - d0) / (d1 - d0);
            coords.push([
              dirPath[i].lng + t * (dirPath[i + 1].lng - dirPath[i].lng),
              dirPath[i].lat + t * (dirPath[i + 1].lat - dirPath[i].lat),
            ]);
            break;
          }
        }
      }
      return coords;
    };

    const animate = (ts) => {
      if (!prevTime) prevTime = ts;
      progress = (progress + ((ts - prevTime) / 1000) * SPEED) % PERIOD;
      prevTime = ts;

      const lines = [];
      for (let base = -PERIOD; base < 1 + PERIOD; base += PERIOD) {
        const head = (progress + base) * total;
        const tail = head - SNAKE * total;
        if (head <= 0 || tail >= total) continue;
        const coords = sliceSegment(Math.max(0, tail), Math.min(total, head));
        if (coords.length >= 2) lines.push(coords);
      }

      const map = mapRef.current;
      if (map && lines.length > 0) {
        try {
          const src = map.getSource("route-snake");
          if (src) src.setData({ type: "Feature", geometry: { type: "MultiLineString", coordinates: lines } });
        } catch {}
      }
      dashAnimRef.current = requestAnimationFrame(animate);
    };
    dashAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(dashAnimRef.current);
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

  // Directed path: от старта к финишу
  const { dirPath, reversed, offset } = useMemo(
    () => getDirectedPath(route.path || [], route.startPointIndex, route.finishPointIndex),
    [route.path, route.startPointIndex, route.finishPointIndex]
  );

  const dirSegments = useMemo(
    () => remapSegmentsForDirectedPath(route.segments || [], offset, reversed, dirPath.length),
    [route.segments, offset, reversed, dirPath.length]
  );

  // === Events (manual mode) ===
  const events = useMemo(() => {
    if (!dirPath || dirPath.length < 2) return [];
    return buildRouteEvents(dirPath, route.checkpoints || [], dirSegments, route.finish);
  }, [dirPath, route.checkpoints, dirSegments, route.finish]);

  const currentEvent = events[eventIndex] || null;
  const isLast = eventIndex >= events.length - 1;

  // Получаем audio текущего события для VoiceButton
  const currentAudio = useMemo(() => {
    if (!currentEvent) return null;
    if (currentEvent.type === "segment") return currentEvent.data.audio;
    if (currentEvent.type === "checkpoint") return currentEvent.data.audio;
    return null;
  }, [currentEvent]);

  // Заголовок текущего события для bottom sheet
  const currentTitle = useMemo(() => {
    if (!currentEvent) return "";
    if (currentEvent.type === "segment") return currentEvent.data.title || "Отрезок";
    if (currentEvent.type === "checkpoint") return currentEvent.data.title || `Точка #${currentEvent.data.order + 1}`;
    if (currentEvent.type === "finish") return "Финиш";
    return "";
  }, [currentEvent]);

  // === GPS auto-advance ===
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

  useEffect(() => {
    if (gpsMode !== "gps_finished" || !started) return;
    const idx = events.findIndex((e) => e.type === "finish");
    if (idx >= 0) {
      setEventIndex(idx);
    }
  }, [gpsMode, started, events]);

  // === GeoJSON ===
  const PATH_COLORS = ["#3b82f6", "#8b5cf6"];
  const pathSegmentsGeoJson = useMemo(() => {
    if (!dirPath || dirPath.length < 2) return null;
    const parts = splitPathByCheckpoints(dirPath, route.checkpoints || []);
    const features = parts.map((segment, i) => ({
      type: "Feature",
      properties: { colorIndex: i % 2 },
      geometry: {
        type: "LineString",
        coordinates: segment.map((p) => [p.lng, p.lat]),
      },
    }));
    return { type: "FeatureCollection", features };
  }, [dirPath, route.checkpoints]);

  const coloredSegmentsGeoJson = useMemo(() => {
    if (!dirPath || dirPath.length < 2 || dirSegments.length === 0) return null;
    const features = [];
    for (const seg of dirSegments) {
      if (!seg.color || seg.pathIndex == null) continue;
      const i = seg.pathIndex;
      if (i >= dirPath.length - 1) continue;
      features.push({
        type: "Feature",
        properties: { color: seg.color },
        geometry: {
          type: "LineString",
          coordinates: [[dirPath[i].lng, dirPath[i].lat], [dirPath[i + 1].lng, dirPath[i + 1].lat]],
        },
      });
    }
    if (features.length === 0) return null;
    return { type: "FeatureCollection", features };
  }, [dirPath, dirSegments]);

  const activeSegmentGeoJson = useMemo(() => {
    if (!currentEvent || !started || gpsMode === "gps_active") return null;
    if (currentEvent.type !== "segment") return null;
    const i = currentEvent.data.pathIndex;
    if (i == null || i < 0 || i >= dirPath.length - 1) return null;
    const segStart = { lat: dirPath[i].lat, lng: dirPath[i].lng };
    const segEnd = { lat: dirPath[i + 1].lat, lng: dirPath[i + 1].lng };
    const dividers = (route.checkpoints || []).filter((cp) => cp.isDivider);
    const splitsOnEdge = dividers
      .map((cp) => {
        const proj = projectPointOnPath(cp.position, dirPath);
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
  }, [currentEvent, started, gpsMode, dirPath, route.checkpoints]);

  const activeAfterDividerGeoJson = useMemo(() => {
    if (!currentEvent || !started || gpsMode === "gps_active") return null;
    if (currentEvent.type !== "checkpoint" || !currentEvent.data.isDivider) return null;
    const proj = projectPointOnPath(currentEvent.data.position, dirPath);
    if (!proj) return null;
    const i = proj.pathIndex;
    if (i < 0 || i >= dirPath.length - 1) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [proj.position.lng, proj.position.lat],
          [dirPath[i + 1].lng, dirPath[i + 1].lat],
        ],
      },
    };
  }, [currentEvent, started, gpsMode, dirPath]);

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

  // === "Начать маршрут" — только ручной режим, без GPS ===
  const handleStart = () => {
    setStarted(true);
    setGpsError(null);
    setCompleteSent(false);
    setSheetExpanded(false);
  };

  // === GPS toggle ===
  const handleToggleGps = () => {
    if (gpsMode === "gps_active" || gpsMode === "gps_requesting") {
      // Остановить GPS
      gps.stopGps();
      setGpsMode(null);
      setGpsError(null);
      setAutoFollow(true);
      setCompleteSent(false);
      userDragRef.current = false;
    } else {
      // Запустить GPS
      setGpsError(null);
      setGpsMode("gps_requesting");
      setAutoFollow(true);
      setCompleteSent(false);
      userDragRef.current = false;
      lastCameraRef.current = 0;
      gps.startGps();
      requestPermission();
    }
  };

  const handleStopGps = () => {
    gps.stopGps();
    setGpsMode(null);
    setGpsError(null);
    setAutoFollow(true);
    setCompleteSent(false);
    userDragRef.current = false;
  };

  const handleNext = () => {
    if (!isLast) setEventIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (eventIndex > 0) setEventIndex((i) => i - 1);
  };

  const isGpsOverlay = gpsMode === "gps_active" || gpsMode === "gps_finished";

  // === Рендер карты (общий для preview и started) ===
  const mapContent = (
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
      style={{ height: "100%", width: "100%" }}
      mapStyle={STYLE}
      attributionControl={true}
    >
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
        </Source>
      )}

      {dirPath.length >= 2 && (
        <Source id="route-snake" type="geojson" data={{
          type: "Feature", geometry: { type: "LineString", coordinates: [[dirPath[0].lng, dirPath[0].lat], [dirPath[0].lng, dirPath[0].lat]] },
        }}>
          <Layer id="route-snake-line" type="line" paint={{
            "line-color": "#ffffff", "line-width": 4, "line-opacity": 0.5,
          }} />
        </Source>
      )}

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

      {isGpsOverlay && gps.passedGeoJson && (
        <Source id="passed-route" type="geojson" data={gps.passedGeoJson}>
          <Layer id="passed-route-line" type="line"
            paint={{ "line-color": "#808080", "line-width": 4, "line-opacity": 0.5 }} />
        </Source>
      )}

      {isGpsOverlay && gps.remainingGeoJson && (
        <Source id="remaining-route" type="geojson" data={gps.remainingGeoJson}>
          <Layer id="remaining-route-base" type="line"
            paint={{ "line-color": "#3b82f6", "line-width": 4, "line-opacity": 0.5 }} />
        </Source>
      )}

      {isGpsOverlay && accuracyGeoJson && (
        <Source id="accuracy-circle" type="geojson" data={accuracyGeoJson}>
          <Layer id="accuracy-circle-fill" type="fill"
            paint={{ "fill-color": "#4285f4", "fill-opacity": 0.1 }} />
          <Layer id="accuracy-circle-border" type="line"
            paint={{ "line-color": "#4285f4", "line-opacity": 0.3, "line-width": 1 }} />
        </Source>
      )}

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

      {dirPath.length >= 2 && (
        <Marker longitude={dirPath[0].lng} latitude={dirPath[0].lat}>
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            background: "#22c55e", border: "2px solid white",
            boxShadow: "0 1px 4px rgba(0,0,0,.3)",
          }} />
        </Marker>
      )}

      {route.checkpoints?.filter((cp) => !cp.isEmpty && cp.color !== "transparent").map((cp) => {
        const isTriggeredGps = isGpsOverlay && gps.triggeredIds.has(cp.id);
        const isActive = started && currentEvent?.type === "checkpoint" && currentEvent.data.id === cp.id;
        const color = isTriggeredGps
          ? "#22c55e"
          : isActive ? "#ef4444" : (cp.color || "#f59e0b");
        const label = isTriggeredGps ? "\u2713" : (cp.order + 1);
        const size = isActive ? 18 : 14;
        return (
          <Marker key={cp.id} longitude={cp.position.lng} latitude={cp.position.lat}>
            <Dot color={color} size={size} label={label} pulse={isActive} />
          </Marker>
        );
      })}

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

      {isGpsOverlay && gps.position && (
        <Marker longitude={gps.position.lng} latitude={gps.position.lat}>
          <div className="gps-dot">
            <div className="gps-dot-pulse" />
            <div className="gps-dot-core" />
          </div>
        </Marker>
      )}
    </Map>
  );

  // ===================================================================
  // === STARTED MODE: fullscreen map + bottom sheet ===
  // ===================================================================
  if (started) {
    return (
      <div className="relative" style={{ height: "calc(100dvh - 80px)" }}>
        {/* Fullscreen map */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {mapContent}
        </div>

        {/* GPS toggle button */}
        <button
          onClick={handleToggleGps}
          className={`absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-lg border transition ${
            gpsMode === "gps_active"
              ? "bg-blue-600 border-blue-700 text-white"
              : gpsMode === "gps_requesting"
                ? "bg-white border-blue-300 text-blue-600 animate-pulse"
                : "bg-white border-gray-200 text-gray-500 hover:text-blue-600"
          }`}
          title={gpsMode === "gps_active" ? "Остановить GPS" : "Включить GPS"}
        >
          <Navigation className="h-5 w-5" />
        </button>

        {/* Recenter button */}
        {isGpsOverlay && !autoFollow && (
          <button
            onClick={handleRecenter}
            className="absolute top-16 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 text-blue-600 hover:bg-gray-50 transition"
          >
            <Locate className="h-5 w-5" />
          </button>
        )}

        {/* GPS error toast */}
        {gpsError && (
          <div className="absolute top-3 left-3 right-16 z-10 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-1.5">
            <span className="shrink-0">&#9888;</span>
            <span>{gpsError}</span>
          </div>
        )}

        {/* Bottom Sheet */}
        <BottomSheet
          expanded={sheetExpanded}
          onToggle={() => setSheetExpanded((v) => !v)}
        >
          {/* Collapsed header: arrows + counter + title + voice */}
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={eventIndex === 0}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] transition disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => setSheetExpanded((v) => !v)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
                    {eventIndex + 1}/{events.length}
                  </span>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {currentTitle}
                  </p>
                </div>
                {/* GPS progress mini */}
                {gpsMode === "gps_active" && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${Math.round(gps.progress * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">
                      {gps.distanceRemaining > 1000
                        ? `${(gps.distanceRemaining / 1000).toFixed(1)} км`
                        : `${Math.round(gps.distanceRemaining)} м`
                      }
                    </span>
                  </div>
                )}
              </div>

              <VoiceButton audioUrls={currentAudio} />

              {gpsMode === "gps_active" ? (
                <div className="h-9 w-9 shrink-0" />
              ) : (
                <button
                  onClick={handleNext}
                  disabled={isLast}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white transition hover:bg-green-700 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Off-route warning */}
            {gpsMode === "gps_active" && gps.isOffRoute && (
              <div className="mt-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] text-amber-700 text-center">
                Вы отклонились от маршрута
              </div>
            )}
          </div>

          {/* Expanded content */}
          {sheetExpanded && currentEvent && (
            <div className="px-4 pb-4 space-y-3 no-drag">
              {/* GPS panel */}
              {gpsMode === "gps_active" && (
                <div className="rounded-xl bg-[var(--bg-elevated)] p-3 space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                      <span>{Math.round(gps.progress * 100)}%</span>
                      <span>{gps.distanceRemaining > 1000
                        ? `${(gps.distanceRemaining / 1000).toFixed(1)} км`
                        : `${Math.round(gps.distanceRemaining)} м`
                      }</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${Math.round(gps.progress * 100)}%` }}
                      />
                    </div>
                  </div>
                  {gps.accuracy > 100 && (
                    <p className="text-[10px] text-[var(--text-muted)] text-center">
                      Низкая точность GPS ({Math.round(gps.accuracy)}м)
                    </p>
                  )}
                  <button
                    onClick={handleStopGps}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Остановить GPS
                  </button>
                </div>
              )}

              {/* Event content */}
              {currentEvent.type === "segment" && (
                <>
                  {currentEvent.data.title && (
                    <h3 className="text-base font-bold text-[var(--text-primary)] text-center">
                      {currentEvent.data.title}
                    </h3>
                  )}
                  {currentEvent.data.text && (
                    <div className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
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
                      <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
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

              {currentEvent.type === "finish" && (
                <div className="text-center py-2 space-y-3">
                  <p className="text-lg font-bold text-green-600">Маршрут пройден!</p>
                  {currentEvent.data.coinsReward > 0 && (
                    <p className="text-sm text-green-600">+{currentEvent.data.coinsReward} монет за финиш</p>
                  )}
                  {gps.totalCoins > 0 && (
                    <p className="text-sm text-green-600">+{gps.totalCoins} монет всего</p>
                  )}
                  <a href="/routes" className="inline-block rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-700">
                    К маршрутам
                  </a>
                </div>
              )}
            </div>
          )}
        </BottomSheet>

        {/* GPS Finished overlay */}
        {gpsMode === "gps_finished" && (
          <div className="absolute top-3 left-3 right-16 z-10 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-center space-y-2 shadow-lg animate-slide-up">
            <p className="text-base font-bold text-green-600">Маршрут пройден!</p>
            {gps.totalCoins > 0 && (
              <p className="text-sm text-green-600">+{gps.totalCoins} монет</p>
            )}
            <div className="flex gap-2 justify-center">
              <a
                href="/routes"
                className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                К маршрутам
              </a>
              <button
                onClick={handleStopGps}
                className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===================================================================
  // === PREVIEW MODE (before start) ===
  // ===================================================================
  return (
    <div className="space-y-4">
      {/* Карта */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-sm relative" style={{ height: 300 }}>
        {mapContent}

        {isGpsOverlay && !autoFollow && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 text-blue-600 hover:bg-gray-50 transition"
          >
            <Locate className="h-5 w-5" />
          </button>
        )}
      </div>

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
          <span className="shrink-0 mt-0.5">&#9888;</span>
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

      {/* Кнопка старт */}
      <button
        onClick={handleStart}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-green-700 active:bg-green-800"
      >
        <Navigation className="h-5 w-5" />
        Начать маршрут
      </button>
    </div>
  );
}
