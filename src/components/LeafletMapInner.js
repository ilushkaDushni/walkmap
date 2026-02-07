"use client";

import { useRef, useCallback, useMemo } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Цвета маркеров
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
  finish = null,
  onMapClick,
  onPathPointDrag,
  onPathPointRightClick,
  onCheckpointClick,
  onCheckpointDrag,
  onFinishDrag,
  selectedCheckpointId,
}) {
  const mapRef = useRef(null);

  const handleClick = useCallback(
    (e) => {
      if (mode === "view" || !onMapClick) return;
      onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng }, mode);
    },
    [mode, onMapClick]
  );

  // GeoJSON для линии пути
  const pathGeoJson = useMemo(() => {
    if (path.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: path.map((p) => [p.lng, p.lat]),
      },
    };
  }, [path]);

  const cursor = mode === "view" ? "grab" : "crosshair";

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: center.lng,
        latitude: center.lat,
        zoom: zoom,
      }}
      style={{ height: "60vh", width: "100%" }}
      mapStyle={STYLE}
      onClick={handleClick}
      cursor={cursor}
      attributionControl={true}
    >
      {/* Линия пути */}
      {pathGeoJson && (
        <Source id="route-path" type="geojson" data={pathGeoJson}>
          <Layer
            id="route-path-line"
            type="line"
            paint={{
              "line-color": "#3b82f6",
              "line-width": 3,
              "line-opacity": 0.8,
            }}
          />
        </Source>
      )}

      {/* Точки пути (только в режиме drawPath) */}
      {mode === "drawPath" &&
        path.map((p, i) => (
          <Marker
            key={`path-${i}`}
            longitude={p.lng}
            latitude={p.lat}
            draggable
            onDragEnd={(e) => {
              onPathPointDrag?.(i, { lat: e.lngLat.lat, lng: e.lngLat.lng });
            }}
          >
            <div
              onContextMenu={(e) => {
                e.preventDefault();
                onPathPointRightClick?.(i);
              }}
            >
              <Dot color="#3b82f6" size={10} />
            </div>
          </Marker>
        ))}

      {/* Чекпоинты */}
      {checkpoints.map((cp) => (
        <Marker
          key={cp.id}
          longitude={cp.position.lng}
          latitude={cp.position.lat}
          draggable={mode === "addCheckpoint"}
          onDragEnd={(e) => {
            onCheckpointDrag?.(cp.id, { lat: e.lngLat.lat, lng: e.lngLat.lng });
          }}
        >
          <div onClick={() => onCheckpointClick?.(cp.id)}>
            <Dot
              color={selectedCheckpointId === cp.id ? "#ef4444" : "#f59e0b"}
              size={16}
              label={cp.order + 1}
            />
          </div>
        </Marker>
      ))}

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
    </Map>
  );
}
