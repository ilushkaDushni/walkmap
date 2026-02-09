"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { projectPointOnPath, splitPathByCheckpoints } from "@/lib/geo";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Ростов-на-Дону и окрестности
const ROSTOV_BOUNDS = [[38.8, 46.9], [40.6, 47.6]];

// Маркер точки пути с long-press и крестиком удаления
function PathPointMarker({ index, point, onDrag, onDelete }) {
  const longPressRef = useRef(null);

  const startLongPress = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      onDelete?.(index);
    }, 600);
  }, [index, onDelete]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  return (
    <Marker
      longitude={point.lng}
      latitude={point.lat}
      draggable
      onDragEnd={(e) => {
        cancelLongPress();
        onDrag?.(index, { lat: e.lngLat.lat, lng: e.lngLat.lng });
      }}
    >
      <div
        className="group relative"
        onContextMenu={(e) => {
          e.preventDefault();
          onDelete?.(index);
        }}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        style={{ padding: 8, margin: -8 }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#3b82f6",
            border: "2px solid white",
            boxShadow: "0 1px 4px rgba(0,0,0,.3)",
            cursor: "pointer",
          }}
        />
        {/* Крестик при hover (десктоп) */}
        <div
          className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#ef4444",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            color: "white",
            lineHeight: 1,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(index);
          }}
        >
          ×
        </div>
      </div>
    </Marker>
  );
}

// Маркер чекпоинта с крестиком удаления
function CheckpointMarker({ cp, isSelected, isDraggable, onClick, onDrag, onDelete, path }) {
  const longPressRef = useRef(null);

  const startLongPress = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      if (window.confirm(`Удалить точку #${cp.order + 1}?`)) {
        onDelete?.(cp.id);
      }
    }, 600);
  }, [cp.id, cp.order, onDelete]);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  return (
    <Marker
      longitude={cp.position.lng}
      latitude={cp.position.lat}
      draggable={isDraggable}
      onDragEnd={(e) => {
        cancelLongPress();
        const pos = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (path && path.length >= 2) {
          const proj = projectPointOnPath(pos, path);
          if (proj && proj.distance < 50) {
            onDrag?.(cp.id, proj.position);
            return;
          }
        }
        onDrag?.(cp.id, pos);
      }}
    >
      <div
        className="group relative"
        onClick={(e) => { e.stopPropagation(); onClick?.(cp.id); }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (window.confirm(`Удалить точку #${cp.order + 1}?`)) {
            onDelete?.(cp.id);
          }
        }}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        style={{ padding: 6, margin: -6 }}
      >
        {cp.isEmpty ? (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: `2px dashed ${isSelected ? "#ef4444" : (cp.color || "#f59e0b")}`,
              background: "transparent",
              boxShadow: "0 1px 4px rgba(0,0,0,.2)",
              cursor: "pointer",
            }}
          />
        ) : (
          <Dot
            color={isSelected ? "#ef4444" : (cp.color || "#f59e0b")}
            size={16}
            label={cp.order + 1}
          />
        )}
        {/* Крестик при hover (десктоп) */}
        <div
          className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#ef4444",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 700,
            color: "white",
            lineHeight: 1,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm(`Удалить точку #${cp.order + 1}?`)) {
              onDelete?.(cp.id);
            }
          }}
        >
          ×
        </div>
      </div>
    </Marker>
  );
}

// Круглый маркер
function Dot({ color, size = 12, label }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: "2px solid white",
        boxShadow: "0 1px 4px rgba(0,0,0,.3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontWeight: 700,
        color: "white",
      }}
    >
      {label}
    </div>
  );
}

/**
 * Интерактивная MapLibre-карта для редактора маршрутов.
 */
export default function LeafletMapInner({
  center,
  zoom,
  mode = "view",
  path = [],
  checkpoints = [],
  segments = [],
  finish = null,
  onMapClick,
  onPathPointDrag,
  onPathPointRightClick,
  onPathInsert,
  onCheckpointClick,
  onCheckpointDrag,
  onSegmentLineClick,
  onCheckpointDelete,
  onFinishDrag,
  selectedCheckpointId,
  selectedSegmentIndex,
  segmentIndicesWithContent = [],
  simulatedPosition = null,
}) {
  const mapRef = useRef(null);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(null);
  const [ghostDot, setGhostDot] = useState(null); // { lat, lng } для превью чекпоинта

  // fitBounds к маршруту если есть достаточно точек
  const routeBounds = useMemo(() => {
    const points = [];
    path.forEach((p) => points.push([p.lng, p.lat]));
    checkpoints.forEach((cp) => points.push([cp.position.lng, cp.position.lat]));
    if (finish?.position) points.push([finish.position.lng, finish.position.lat]);
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
  }, [path, checkpoints, finish]);

  // GeoJSON для каждого отрезка пути — для hit-слоя вставки точек
  const pathSegmentHitGeoJson = useMemo(() => {
    if (path.length < 2) return null;
    const features = [];
    for (let i = 0; i < path.length - 1; i++) {
      features.push({
        type: "Feature",
        properties: { insertIndex: i + 1 },
        geometry: {
          type: "LineString",
          coordinates: [
            [path[i].lng, path[i].lat],
            [path[i + 1].lng, path[i + 1].lat],
          ],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [path]);

  const handleClick = useCallback(
    (e) => {
      // Снять фокус с текстовых полей чтобы Ctrl+Z работал для действий на карте
      const active = document.activeElement;
      if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA") {
        active.blur();
      }
      if (mode === "view") return;

      // В режиме drawPath — проверяем hit по path-segment-hit-line
      if (mode === "drawPath") {
        if (e.features && e.features.length > 0) {
          const hitFeature = e.features.find((f) => f.layer?.id === "path-segment-hit-line");
          if (hitFeature) {
            const insertIndex = hitFeature.properties.insertIndex;
            onPathInsert?.(insertIndex, { lat: e.lngLat.lat, lng: e.lngLat.lng });
            return;
          }
        }
        onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, mode);
        return;
      }

      // В режиме addCheckpoint — snap к пути если рядом, иначе ставим где кликнули
      if (mode === "addCheckpoint") {
        const clickPos = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (path.length >= 2) {
          const proj = projectPointOnPath(clickPos, path);
          // Snap если ближе 50 метров к маршруту
          if (proj && proj.distance < 50) {
            onMapClick?.(proj.position, mode);
            setGhostDot(null);
            return;
          }
        }
        onMapClick?.(clickPos, mode);
        setGhostDot(null);
        return;
      }

      // В режиме addSegment — обрабатываем клик по отрезку
      if (mode === "addSegment") {
        if (e.features && e.features.length > 0) {
          const pathIndex = e.features[0].properties.pathIndex;
          onSegmentLineClick?.(pathIndex);
        }
        return;
      }
      onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, mode);
    },
    [mode, onMapClick, onSegmentLineClick, onPathInsert]
  );

  // GeoJSON для линии пути — разбитый по чекпоинтам на чередующиеся сегменты
  const PATH_COLORS = ["#3b82f6", "#8b5cf6"];
  const pathSegmentsGeoJson = useMemo(() => {
    if (path.length < 2) return null;
    const parts = splitPathByCheckpoints(path, checkpoints);
    const features = parts.map((segment, i) => ({
      type: "Feature",
      properties: { colorIndex: i % 2 },
      geometry: {
        type: "LineString",
        coordinates: segment.map((p) => [p.lng, p.lat]),
      },
    }));
    return { type: "FeatureCollection", features };
  }, [path, checkpoints]);

  // GeoJSON FeatureCollection: каждый отрезок пути — отдельный Feature (для сегментов)
  const segmentLinesGeoJson = useMemo(() => {
    if (path.length < 2) return null;
    const features = [];
    for (let i = 0; i < path.length - 1; i++) {
      features.push({
        type: "Feature",
        properties: { pathIndex: i },
        geometry: {
          type: "LineString",
          coordinates: [
            [path[i].lng, path[i].lat],
            [path[i + 1].lng, path[i + 1].lat],
          ],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [path]);

  // Обработчики hover на слое сегментов + ghost dot для addCheckpoint
  const handleMouseMove = useCallback(
    (e) => {
      if (mode === "addSegment") {
        if (e.features && e.features.length > 0) {
          setHoveredSegmentIndex(e.features[0].properties.pathIndex);
        }
      }
      if (mode === "addCheckpoint" && path.length >= 2) {
        const proj = projectPointOnPath({ lat: e.lngLat.lat, lng: e.lngLat.lng }, path);
        if (proj && proj.distance < 50) {
          setGhostDot(proj.position);
        } else {
          setGhostDot(null);
        }
      }
    },
    [mode, path]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredSegmentIndex(null);
    setGhostDot(null);
  }, []);

  // Фильтры для слоёв
  const filledFilter = useMemo(() => {
    if (segmentIndicesWithContent.length === 0) return ["==", ["get", "pathIndex"], -1];
    if (segmentIndicesWithContent.length === 1) return ["==", ["get", "pathIndex"], segmentIndicesWithContent[0]];
    return ["any", ...segmentIndicesWithContent.map((idx) => ["==", ["get", "pathIndex"], idx])];
  }, [segmentIndicesWithContent]);

  const hoveredFilter = useMemo(
    () =>
      hoveredSegmentIndex !== null
        ? ["==", ["get", "pathIndex"], hoveredSegmentIndex]
        : ["==", ["get", "pathIndex"], -1],
    [hoveredSegmentIndex]
  );

  const selectedFilter = useMemo(
    () =>
      selectedSegmentIndex !== null
        ? ["==", ["get", "pathIndex"], selectedSegmentIndex]
        : ["==", ["get", "pathIndex"], -1],
    [selectedSegmentIndex]
  );

  const interactiveLayerIds = useMemo(() => {
    const ids = [];
    if (mode === "addSegment") ids.push("segment-lines-hit");
    if (mode === "drawPath") ids.push("path-segment-hit-line");
    return ids;
  }, [mode]);

  const cursor = mode === "view" ? "grab" : "crosshair";

  const isAddSegment = mode === "addSegment";

  return (
    <Map
      ref={mapRef}
      initialViewState={
        routeBounds
          ? { bounds: routeBounds, fitBoundsOptions: { padding: 40 } }
          : { longitude: center.lng, latitude: center.lat, zoom: zoom }
      }
      style={{ height: "60vh", width: "100%" }}
      mapStyle={STYLE}
      maxBounds={ROSTOV_BOUNDS}
      minZoom={10}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      interactiveLayerIds={interactiveLayerIds}
      cursor={cursor}
      attributionControl={true}
    >
      {/* Линия пути — чередующиеся цвета по чекпоинтам */}
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

      {/* Невидимый hit-слой для вставки точек в режиме drawPath */}
      {mode === "drawPath" && pathSegmentHitGeoJson && (
        <Source id="path-segment-hit" type="geojson" data={pathSegmentHitGeoJson}>
          <Layer
            id="path-segment-hit-line"
            type="line"
            paint={{
              "line-color": "transparent",
              "line-width": 20,
              "line-opacity": 0,
            }}
          />
        </Source>
      )}

      {/* Индикаторы сегментов с контентом — видимы во ВСЕХ режимах */}
      {segmentLinesGeoJson && (
        <Source id="segment-indicators" type="geojson" data={segmentLinesGeoJson}>
          <Layer
            id="segment-indicator-filled"
            type="line"
            filter={filledFilter}
            paint={{
              "line-color": "#f97316",
              "line-width": isAddSegment ? 5 : 3,
              "line-opacity": isAddSegment ? 0.8 : 0.4,
            }}
          />
        </Source>
      )}

      {/* Интерактивные слои сегментов (только в режиме addSegment) */}
      {isAddSegment && segmentLinesGeoJson && (
        <Source id="segment-lines-interactive" type="geojson" data={segmentLinesGeoJson}>
          {/* Невидимый толстый слой для удобного клика */}
          <Layer
            id="segment-lines-hit"
            type="line"
            paint={{
              "line-color": "transparent",
              "line-width": 16,
              "line-opacity": 0,
            }}
          />
          {/* Hover — оранжевый яркий */}
          <Layer
            id="segment-hovered"
            type="line"
            filter={hoveredFilter}
            paint={{
              "line-color": "#fb923c",
              "line-width": 7,
              "line-opacity": 0.9,
            }}
          />
          {/* Выделенный — красный */}
          <Layer
            id="segment-selected"
            type="line"
            filter={selectedFilter}
            paint={{
              "line-color": "#ef4444",
              "line-width": 7,
              "line-opacity": 1,
            }}
          />
        </Source>
      )}

      {/* Точки пути (только в режиме drawPath) */}
      {mode === "drawPath" &&
        path.map((p, i) => (
          <PathPointMarker
            key={`path-${i}`}
            index={i}
            point={p}
            onDrag={onPathPointDrag}
            onDelete={onPathPointRightClick}
          />
        ))}

      {/* Чекпоинты */}
      {checkpoints.map((cp) => (
        <CheckpointMarker
          key={cp.id}
          cp={cp}
          isSelected={selectedCheckpointId === cp.id}
          isDraggable={mode === "addCheckpoint"}
          onClick={onCheckpointClick}
          onDrag={onCheckpointDrag}
          onDelete={onCheckpointDelete}
          path={path}
        />
      ))}

      {/* Ghost dot — превью чекпоинта при наведении */}
      {mode === "addCheckpoint" && ghostDot && (
        <Marker longitude={ghostDot.lng} latitude={ghostDot.lat}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#f59e0b",
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,.3)",
              opacity: 0.5,
              pointerEvents: "none",
            }}
          />
        </Marker>
      )}

      {/* Финиш */}
      {finish?.position && (
        <Marker
          longitude={finish.position.lng}
          latitude={finish.position.lat}
          draggable={mode === "setFinish"}
          onDragEnd={(e) => {
            onFinishDrag?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }}
        >
          <Dot color="#22c55e" size={18} label="F" />
        </Marker>
      )}

      {/* Симулированная позиция пользователя */}
      {mode === "simulate" && simulatedPosition && (
        <Marker
          longitude={simulatedPosition.lng}
          latitude={simulatedPosition.lat}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#3b82f6",
              border: "3px solid white",
              boxShadow: "0 0 10px #3b82f688",
              animation: "pulse 2s infinite",
            }}
          />
        </Marker>
      )}
    </Map>
  );
}
