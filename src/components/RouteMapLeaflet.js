"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import useUserLocation from "@/hooks/useUserLocation";
import useCheckpointTrigger from "@/hooks/useCheckpointTrigger";
import useOfflineDownload from "@/hooks/useOfflineDownload";
import { Download, Check } from "lucide-react";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

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

// Автоподгонка bounds
function useFitBounds(mapRef, route) {
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const map = mapRef.current;
    if (!map) return;

    const points = [];
    route.path?.forEach((p) => points.push([p.lng, p.lat]));
    route.checkpoints?.forEach((cp) => points.push([cp.position.lng, cp.position.lat]));
    if (route.finish?.position) points.push([route.finish.position.lng, route.finish.position.lat]);

    if (points.length < 2) return;

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of points) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 40, duration: 0 }
    );
    fitted.current = true;
  });
}

export default function RouteMapLeaflet({ route }) {
  const { position: gpsPosition, accuracy, status, startTracking, stopTracking } = useUserLocation();
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const mapRef = useRef(null);

  const { triggeredIds, activeCheckpoint, finishReached, totalCoins } = useCheckpointTrigger({
    checkpoints: route.checkpoints,
    finish: route.finish,
    userPosition: gpsEnabled ? gpsPosition : null,
  });

  const { download, downloading, progress, done } = useOfflineDownload(route);

  useFitBounds(mapRef, route);

  const pathGeoJson = useMemo(() => {
    if (!route.path || route.path.length < 2) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: route.path.map((p) => [p.lng, p.lat]),
      },
    };
  }, [route.path]);

  const center = route.mapCenter || { lat: 55.7558, lng: 37.6173 };
  const zoom = route.mapZoom || 14;

  const handleToggleGps = () => {
    if (gpsEnabled) {
      stopTracking();
      setGpsEnabled(false);
    } else {
      startTracking();
      setGpsEnabled(true);
    }
  };

  const onLoad = useCallback((e) => {
    mapRef.current = e.target;
  }, []);

  return (
    <div className="space-y-4">
      {/* Карта */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-sm">
        <Map
          onLoad={onLoad}
          initialViewState={{
            longitude: center.lng,
            latitude: center.lat,
            zoom: zoom,
          }}
          style={{ height: "300px", width: "100%" }}
          mapStyle={STYLE}
          attributionControl={true}
        >
          {/* Путь */}
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

          {/* Чекпоинты */}
          {route.checkpoints?.map((cp) => (
            <Marker
              key={cp.id}
              longitude={cp.position.lng}
              latitude={cp.position.lat}
            >
              <Dot
                color={triggeredIds.has(cp.id) ? "#ef4444" : "#f59e0b"}
                size={14}
                label={cp.order + 1}
              />
            </Marker>
          ))}

          {/* Финиш */}
          {route.finish?.position && (
            <Marker
              longitude={route.finish.position.lng}
              latitude={route.finish.position.lat}
            >
              <Dot color={finishReached ? "#ef4444" : "#22c55e"} size={16} label="F" />
            </Marker>
          )}

          {/* Позиция пользователя */}
          {gpsEnabled && gpsPosition && (
            <Marker longitude={gpsPosition.lng} latitude={gpsPosition.lat}>
              <Dot color="#3b82f6" size={16} pulse />
            </Marker>
          )}
        </Map>
      </div>

      {/* GPS + Оффлайн */}
      <div className="flex gap-2">
        <button
          onClick={handleToggleGps}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
            gpsEnabled
              ? "bg-blue-600 text-white"
              : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          }`}
        >
          {gpsEnabled
            ? `GPS: ${status === "watching" ? "Отслеживается" : status}`
            : "Включить GPS"}
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

      {/* Информация о чекпоинтах */}
      {gpsEnabled && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">
              Найдено точек: {triggeredIds.size} / {route.checkpoints?.length || 0}
            </span>
            {totalCoins > 0 && (
              <span className="font-medium text-amber-600">+{totalCoins} монет</span>
            )}
          </div>

          {activeCheckpoint && (
            <div className="mt-3 rounded-xl bg-[var(--bg-elevated)] p-3">
              <p className="font-semibold text-[var(--text-primary)]">{activeCheckpoint.title}</p>
              {activeCheckpoint.description && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">{activeCheckpoint.description}</p>
              )}
              {activeCheckpoint.photos?.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {activeCheckpoint.photos.map((url, i) => (
                    <img key={i} src={url} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0" />
                  ))}
                </div>
              )}
            </div>
          )}

          {finishReached && (
            <div className="mt-3 rounded-xl bg-green-500/10 p-3 text-center">
              <p className="font-bold text-green-600">Маршрут пройден!</p>
              {totalCoins > 0 && (
                <p className="text-sm text-green-600">Всего монет: {totalCoins}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
