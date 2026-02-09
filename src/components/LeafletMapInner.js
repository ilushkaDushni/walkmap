"use client";

import { useRef, useCallback, useMemo, useState } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { projectPointOnPath, splitPathByCheckpoints, haversineDistance } from "@/lib/geo";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Ростов-на-Дону и окрестности
const ROSTOV_BOUNDS = [[38.8, 46.9], [40.6, 47.6]];

// Маркер точки пути с long-press и контекстным меню
function PathPointMarker({ index, point, isStart, isFinish, isMerged, onDrag, onContextMenu }) {
  const longPressRef = useRef(null);

  const startLongPress = useCallback(() => {
    longPressRef.current = setTimeout((e) => {
      // Берём позицию из ref-а не из события
      onContextMenu?.(index, { x: lastTouchRef.current?.x || 0, y: lastTouchRef.current?.y || 0 });
    }, 600);
  }, [index, onContextMenu]);

  const lastTouchRef = useRef(null);

  const cancelLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  // Стиль точки
  let markerStyle;
  if (isFinish) {
    // Шахматный квадрат
    markerStyle = {
      width: 14,
      height: 14,
      borderRadius: 2,
      background: "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 7px 7px",
      border: isStart ? "2px solid #22c55e" : "2px solid white",
      boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      cursor: "pointer",
    };
  } else if (isStart) {
    // Зелёный круг
    markerStyle = {
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: "#22c55e",
      border: "2px solid white",
      boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      cursor: "pointer",
    };
  } else if (isMerged) {
    // Объединённая точка — полупрозрачное кольцо
    markerStyle = {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: "white",
      border: "2px solid #3b82f6",
      boxShadow: "0 1px 4px rgba(0,0,0,.15)",
      cursor: "pointer",
      opacity: 0.4,
    };
  } else {
    // Стык — кольцо (белый центр, синяя обводка)
    markerStyle = {
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: "white",
      border: "3px solid #3b82f6",
      boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      cursor: "pointer",
    };
  }

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
          onContextMenu?.(index, { x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
          startLongPress();
        }}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        style={{ padding: 8, margin: -8 }}
      >
        <div style={markerStyle} />
      </div>
    </Marker>
  );
}

// Маркер чекпоинта с крестиком удаления
function CheckpointMarker({ cp, isSelected, isBound, isDraggable, onClick, onDrag, onDelete, path }) {
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
          <div style={{ opacity: cp.color === "transparent" ? 0.25 : 1 }}>
            <Dot
              color={isSelected ? "#ef4444" : (cp.color === "transparent" ? "#9ca3af" : (cp.color || "#f59e0b"))}
              size={isBound ? 18 : 16}
              label={cp.order + 1}
              borderWidth={isBound ? 3 : 2}
              borderColor="white"
            />
          </div>
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
function Dot({ color, size = 12, label, borderWidth = 2, borderColor = "white" }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: `${borderWidth}px solid ${borderColor}`,
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
  branches = [],
  activeBranchId = null,
  mainPath = [],
  mainCheckpoints = [],
  startPointIndex = null,
  finishPointIndex = null,
  onMapClick,
  onPathPointDrag,
  onPathPointRightClick,
  onPathInsert,
  onCheckpointClick,
  onCheckpointDrag,
  onSegmentLineClick,
  onCheckpointDelete,
  onPathPointContextMenu,
  onPathLineContextMenu,
  selectedCheckpointId,
  selectedSegmentIndex,
  segmentIndicesWithContent = [],
  simulatedPosition = null,
  onBranchClick,
  onMergeClick,
}) {
  const mapRef = useRef(null);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState(null);
  const [ghostDot, setGhostDot] = useState(null); // { lat, lng } для превью чекпоинта
  const [branchGhostDot, setBranchGhostDot] = useState(null); // { lat, lng } для превью fork point

  // fitBounds к маршруту если есть достаточно точек
  const routeBounds = useMemo(() => {
    const points = [];
    path.forEach((p) => points.push([p.lng, p.lat]));
    checkpoints.forEach((cp) => points.push([cp.position.lng, cp.position.lat]));
    if (finish?.position) points.push([finish.position.lng, finish.position.lat]);
    // Включаем точки веток
    branches.forEach((b) => {
      (b.path || []).forEach((p) => points.push([p.lng, p.lat]));
    });
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
  }, [path, checkpoints, finish, branches]);

  // GeoJSON для неактивных веток (пунктир)
  const inactiveBranchesGeoJson = useMemo(() => {
    const features = [];
    for (const branch of branches) {
      if (branch.id === activeBranchId) continue;
      if (!branch.path || branch.path.length < 2) continue;
      features.push({
        type: "Feature",
        properties: { color: branch.color || "#10b981", branchId: branch.id },
        geometry: {
          type: "LineString",
          coordinates: branch.path.map((p) => [p.lng, p.lat]),
        },
      });
    }
    return features.length > 0 ? { type: "FeatureCollection", features } : null;
  }, [branches, activeBranchId]);

  // Main path GeoJSON (приглушённый когда редактируем ветку)
  const mainPathGeoJson = useMemo(() => {
    if (!activeBranchId || mainPath.length < 2) return null;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: mainPath.map((p) => [p.lng, p.lat]),
      },
    };
  }, [activeBranchId, mainPath]);

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

      // В режиме addBranch — проецируем клик на текущий path и создаём ветку
      if (mode === "addBranch") {
        const clickPos = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (path.length >= 2) {
          const proj = projectPointOnPath(clickPos, path);
          if (proj && proj.distance < 100) {
            onBranchClick?.(proj.pathIndex, proj.fraction, proj.position);
            setBranchGhostDot(null);
            return;
          }
        }
        return;
      }

      // В режиме setMerge — проецируем клик на main path (или любой другой) и устанавливаем merge
      if (mode === "setMerge") {
        const clickPos = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        // Сначала проверяем main path
        if (mainPath.length >= 2) {
          const proj = projectPointOnPath(clickPos, mainPath);
          if (proj && proj.distance < 100) {
            onMergeClick?.(null, proj.pathIndex, proj.fraction, proj.position);
            return;
          }
        }
        // Проверяем другие ветки
        for (const branch of branches) {
          if (!branch.path || branch.path.length < 2) continue;
          const proj = projectPointOnPath(clickPos, branch.path);
          if (proj && proj.distance < 100) {
            onMergeClick?.(branch.id, proj.pathIndex, proj.fraction, proj.position);
            return;
          }
        }
        return;
      }

      onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, mode);
    },
    [mode, onMapClick, onSegmentLineClick, onPathInsert, path, mainPath, branches, onBranchClick, onMergeClick]
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

  // GeoJSON FeatureCollection: рёбра пути, сгруппированные через isMerged-точки
  const segmentLinesGeoJson = useMemo(() => {
    if (path.length < 2) return null;
    const features = [];
    let groupStart = 0;
    let coords = [[path[0].lng, path[0].lat]];

    for (let i = 0; i < path.length - 1; i++) {
      coords.push([path[i + 1].lng, path[i + 1].lat]);
      const isLastEdge = i === path.length - 2;
      // Следующая точка — «склейка»? → продолжаем группу
      const nextIsMerged = !isLastEdge && path[i + 1].isMerged;

      if (isLastEdge || !nextIsMerged) {
        features.push({
          type: "Feature",
          properties: { pathIndex: groupStart },
          geometry: { type: "LineString", coordinates: coords },
        });
        if (!isLastEdge) {
          groupStart = i + 1;
          coords = [[path[i + 1].lng, path[i + 1].lat]];
        }
      }
    }
    return { type: "FeatureCollection", features };
  }, [path]);

  // Обработчики hover на слое сегментов + ghost dot для addCheckpoint/addBranch
  const handleMouseMove = useCallback(
    (e) => {
      if (mode === "addSegment") {
        if (e.features && e.features.length > 0) {
          setHoveredSegmentIndex(e.features[0].properties.pathIndex);
        }
      }
      if (mode === "addCheckpoint") {
        const cursorPos = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const nearExisting = checkpoints.some(
          (cp) => haversineDistance(cursorPos, cp.position) < 30
        );
        if (nearExisting) {
          setGhostDot(null);
        } else if (path.length >= 2) {
          const proj = projectPointOnPath(cursorPos, path);
          if (proj && proj.distance < 50) {
            setGhostDot(proj.position);
          } else {
            setGhostDot(null);
          }
        } else {
          setGhostDot(null);
        }
      }
      if (mode === "addBranch") {
        const cursorPos = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        if (path.length >= 2) {
          const proj = projectPointOnPath(cursorPos, path);
          if (proj && proj.distance < 100) {
            setBranchGhostDot(proj.position);
          } else {
            setBranchGhostDot(null);
          }
        } else {
          setBranchGhostDot(null);
        }
      }
    },
    [mode, path, checkpoints]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredSegmentIndex(null);
    setGhostDot(null);
    setBranchGhostDot(null);
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
      onContextMenu={(e) => {
        e.preventDefault();
        // ПКМ по линии пути → контекстное меню
        const features = mapRef.current?.queryRenderedFeatures(e.point, {
          layers: ["path-segment-hit-line"],
        });
        if (features?.length > 0) {
          const insertIndex = features[0].properties.insertIndex;
          onPathLineContextMenu?.(insertIndex, {
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY,
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          });
        }
      }}
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

      {/* Невидимый hit-слой для вставки точек и ПКМ по линии */}
      {pathSegmentHitGeoJson && (
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

      {/* Start/Finish/Junction/Merged маркеры — всегда видны (кроме тех, где есть привязанный чекпоинт) */}
      {path.map((p, i) => {
        const isStart = i === (startPointIndex ?? 0);
        const isFinish = i === finishPointIndex;
        const isJunction = !!p.isJunction;
        const isMerged = !!p.isMerged;
        if (!isStart && !isFinish && !isJunction && !isMerged) return null;
        // Не рисуем отдельный маркер если на этой точке есть привязанный чекпоинт
        if ((isJunction || isMerged) && !isStart && !isFinish && checkpoints.some((cp) => cp.boundToPathIndex === i)) return null;
        return (
          <PathPointMarker
            key={`sf-${i}`}
            index={i}
            point={p}
            isStart={isStart}
            isFinish={isFinish}
            isMerged={isMerged && !isStart && !isFinish}
            onDrag={onPathPointDrag}
            onContextMenu={onPathPointContextMenu}
          />
        );
      })}
      {/* Обычные точки пути — только в режиме drawPath */}
      {mode === "drawPath" &&
        path.map((p, i) => {
          const isStart = i === (startPointIndex ?? 0);
          const isFinish = i === finishPointIndex;
          if (isStart || isFinish || p.isJunction || p.isMerged) return null;
          return (
            <PathPointMarker
              key={`path-${i}`}
              index={i}
              point={p}
              isStart={false}
              isFinish={false}
              isMerged={false}
              onDrag={onPathPointDrag}
              onContextMenu={onPathPointContextMenu}
            />
          );
        })}

      {/* Чекпоинты */}
      {checkpoints.map((cp) => (
        <CheckpointMarker
          key={cp.id}
          cp={cp}
          isSelected={selectedCheckpointId === cp.id}
          isBound={cp.boundToPathIndex != null}
          isDraggable={cp.boundToPathIndex != null ? false : mode !== "view"}
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

      {/* Ghost dot для addBranch — ромбик */}
      {mode === "addBranch" && branchGhostDot && (
        <Marker longitude={branchGhostDot.lng} latitude={branchGhostDot.lat}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#10b981",
              border: "2px solid white",
              boxShadow: "0 1px 4px rgba(0,0,0,.3)",
              opacity: 0.6,
              pointerEvents: "none",
              transform: "rotate(45deg)",
            }}
          />
        </Marker>
      )}

      {/* Приглушённый main path когда редактируем ветку */}
      {mainPathGeoJson && (
        <Source id="main-path-dim" type="geojson" data={mainPathGeoJson}>
          <Layer
            id="main-path-dim-line"
            type="line"
            paint={{
              "line-color": "#3b82f6",
              "line-width": 3,
              "line-opacity": 0.3,
            }}
          />
        </Source>
      )}

      {/* Неактивные ветки — пунктир */}
      {inactiveBranchesGeoJson && (
        <Source id="inactive-branches" type="geojson" data={inactiveBranchesGeoJson}>
          <Layer
            id="inactive-branches-line"
            type="line"
            paint={{
              "line-color": ["get", "color"],
              "line-width": 3,
              "line-opacity": 0.4,
              "line-dasharray": [4, 3],
            }}
          />
        </Source>
      )}

      {/* Fork маркеры (ромбики) */}
      {branches.map((branch) =>
        branch.fork?.position ? (
          <Marker
            key={`fork-${branch.id}`}
            longitude={branch.fork.position.lng}
            latitude={branch.fork.position.lat}
          >
            <div
              style={{
                width: 12,
                height: 12,
                background: branch.color || "#10b981",
                border: "2px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                transform: "rotate(45deg)",
                cursor: "pointer",
              }}
              title={`Развилка: ${branch.name}`}
            />
          </Marker>
        ) : null
      )}

      {/* Merge маркеры (круги) */}
      {branches.map((branch) =>
        branch.merge?.position ? (
          <Marker
            key={`merge-${branch.id}`}
            longitude={branch.merge.position.lng}
            latitude={branch.merge.position.lat}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: branch.color || "#10b981",
                border: "2px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,.3)",
                cursor: "pointer",
              }}
              title={`Слияние: ${branch.name}`}
            />
          </Marker>
        ) : null
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
