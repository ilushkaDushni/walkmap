"use client";

import { useMemo } from "react";
import Map, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Мини-карта маршрута для карточки — настоящий MapLibre (неинтерактивный).
 */
export default function RouteCardMiniMap({ path = [], checkpoints = [] }) {
  const bounds = useMemo(() => {
    if (!path.length) return null;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const p of path) {
      const lng = p.lng ?? p[0];
      const lat = p.lat ?? p[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return [[minLng, minLat], [maxLng, maxLat]];
  }, [path]);

  const geojson = useMemo(() => {
    if (!path.length) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: path.map((p) => [p.lng ?? p[0], p.lat ?? p[1]]),
      },
    };
  }, [path]);

  const cpGeojson = useMemo(() => {
    const features = checkpoints
      .filter((cp) => cp.lat != null && cp.lng != null && !cp.isEmpty)
      .map((cp) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [cp.lng, cp.lat] },
        properties: { color: cp.color || "#22c55e" },
      }));
    return { type: "FeatureCollection", features };
  }, [checkpoints]);

  if (!bounds || !geojson) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
        <span className="text-xs">Нет маршрута</span>
      </div>
    );
  }

  return (
    <Map
      initialViewState={{ bounds, fitBoundsOptions: { padding: 30 } }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={STYLE}
      interactive={false}
      attributionControl={false}
      reuseMaps
    >
      <Source id="minimap-route" type="geojson" data={geojson}>
        <Layer
          id="minimap-route-line"
          type="line"
          paint={{ "line-color": "#3b82f6", "line-width": 3, "line-opacity": 0.9 }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>
      {cpGeojson.features.length > 0 && (
        <Source id="minimap-cp" type="geojson" data={cpGeojson}>
          <Layer
            id="minimap-cp-circles"
            type="circle"
            paint={{
              "circle-radius": 5,
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
      )}
    </Map>
  );
}
