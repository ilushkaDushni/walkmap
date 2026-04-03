"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Navigation, MapPin, Coffee, Compass } from "lucide-react";
import useDeviceOrientation from "@/hooks/useDeviceOrientation";
import { calculateBearing, haversineDistance } from "@/lib/geo";

/**
 * AR-навигация: камера устройства + оверлей с направлением.
 *
 * Показывает:
 * - Видео с задней камеры на весь экран
 * - Стрелку направления к следующей точке
 * - Расстояние и название точки
 * - POI-маркеры при детуре
 * - Поворотные подсказки
 */
export default function ArNavigationView({
  position,         // { lat, lng } — текущая GPS-позиция
  nextEvent,        // { type, data } — следующее событие маршрута
  distanceToNext,   // число — метры до следующего события
  turnDirection,    // { key, label, angle } — подсказка поворота
  detourTarget,     // { lat, lng, name } | null — заведение при детуре
  detourPhase,      // "idle" | "going" | "returning"
  onClose,          // закрыть AR
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const compass = useDeviceOrientation();

  // Запускаем камеру
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        // Останавливаем стрим если play() упал (смена вкладки и т.д.)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (!cancelled) {
          console.error("AR camera error:", err);
          setCameraError(
            err.name === "NotAllowedError"
              ? "Разрешите доступ к камере"
              : "Камера недоступна"
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Запрашиваем компас на iOS при открытии AR
  useEffect(() => {
    if (compass.permissionNeeded) {
      // Не запрашиваем автоматом — покажем кнопку
    }
  }, [compass.permissionNeeded]);

  // Рассчитываем направления
  const targetInfo = useMemo(() => {
    if (!position) return null;

    // При детуре "going" — цель = заведение
    if (detourTarget && detourPhase === "going") {
      const bearing = calculateBearing(position, detourTarget);
      const dist = haversineDistance(position, detourTarget);
      return {
        bearing,
        distance: dist,
        name: detourTarget.name,
        type: "detour",
      };
    }

    // Обычный режим или returning — цель = следующее событие маршрута
    if (nextEvent?.data?.position) {
      const bearing = calculateBearing(position, nextEvent.data.position);
      return {
        bearing,
        distance: distanceToNext,
        name: nextEvent.data?.title || (nextEvent.type === "finish" ? "Финиш" : "Точка"),
        type: nextEvent.type,
      };
    }

    return null;
  }, [position, nextEvent, distanceToNext, detourTarget, detourPhase]);

  // Угол стрелки: bearing к цели минус heading компаса
  const arrowAngle = useMemo(() => {
    if (!targetInfo || compass.heading == null) return 0;
    return (targetInfo.bearing - compass.heading + 360) % 360;
  }, [targetInfo, compass.heading]);

  // Цель "впереди" если угол в пределах ±30°
  const isAhead = arrowAngle < 30 || arrowAngle > 330;
  // Цель "позади"
  const isBehind = arrowAngle > 150 && arrowAngle < 210;

  const formatDist = (d) => {
    if (d == null) return "";
    return d > 1000 ? `${(d / 1000).toFixed(1)} км` : `${Math.round(d)} м`;
  };

  const walkMin = (d) => {
    if (d == null) return 0;
    return Math.max(1, Math.round(d / 83));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Камера */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Затемнение если камера не готова */}
      {!cameraReady && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-white/60 text-sm animate-pulse">Запуск камеры...</div>
        </div>
      )}

      {/* Ошибка камеры */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-3">
          <p className="text-white/80 text-sm">{cameraError}</p>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/20 px-4 py-2 text-sm text-white"
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Запрос компаса (iOS) */}
      {compass.permissionNeeded && cameraReady && (
        <div className="absolute top-20 left-4 right-4 z-20">
          <button
            onClick={compass.requestPermission}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white/20 backdrop-blur-md px-4 py-3 text-sm font-medium text-white border border-white/20"
          >
            <Compass className="h-4 w-4" />
            Включить компас
          </button>
        </div>
      )}

      {/* === AR HUD === */}
      {cameraReady && (
        <>
          {/* Верхняя панель */}
          <div className="absolute top-0 left-0 right-0 z-10 safe-area-top">
            <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <Navigation className="h-4 w-4 text-white" />
                </div>
                <span className="text-white/90 text-sm font-medium">AR-навигация</span>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          {/* Центральная стрелка направления */}
          {targetInfo && compass.heading != null && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              {/* Внешнее кольцо */}
              <div className="relative flex items-center justify-center">
                {/* Кольцо-рамка */}
                <div
                  className="h-32 w-32 rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor: isAhead
                      ? "rgba(34, 197, 94, 0.6)"
                      : isBehind
                      ? "rgba(239, 68, 68, 0.4)"
                      : "rgba(255, 255, 255, 0.3)",
                    background: isAhead
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(0, 0, 0, 0.2)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {/* Стрелка */}
                  <div
                    className="transition-transform duration-300 ease-out"
                    style={{ transform: `rotate(${arrowAngle}deg)` }}
                  >
                    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                      <path
                        d="M30 5 L42 45 L30 37 L18 45 Z"
                        fill={isAhead ? "#22c55e" : isBehind ? "#ef4444" : "#ffffff"}
                        fillOpacity={isAhead ? 0.9 : 0.7}
                        stroke="white"
                        strokeWidth="1.5"
                        strokeOpacity="0.5"
                      />
                    </svg>
                  </div>
                </div>

                {/* Расстояние под стрелкой */}
                <div className="absolute -bottom-14 flex flex-col items-center">
                  <span className="text-2xl font-bold text-white drop-shadow-lg">
                    {formatDist(targetInfo.distance)}
                  </span>
                  <span className="text-xs text-white/70 drop-shadow">
                    ~{walkMin(targetInfo.distance)} мин
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Нижняя панель — цель */}
          <div className="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom">
            <div className="px-4 pb-8 pt-16 bg-gradient-to-t from-black/70 to-transparent">
              {targetInfo ? (
                <div className="space-y-3">
                  {/* Название цели */}
                  <div className="flex items-center gap-2">
                    {targetInfo.type === "detour" ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/80">
                        <Coffee className="h-4 w-4 text-white" />
                      </div>
                    ) : targetInfo.type === "finish" ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/80">
                        <MapPin className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/80">
                        <MapPin className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {targetInfo.name}
                      </p>
                      <p className="text-white/60 text-xs">
                        {targetInfo.type === "detour"
                          ? "Заведение"
                          : targetInfo.type === "finish"
                          ? "Финиш маршрута"
                          : "Следующая точка"}
                      </p>
                    </div>
                  </div>

                  {/* Подсказка поворота */}
                  {turnDirection && targetInfo.type !== "detour" && (
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm px-3 py-2">
                      <span className="text-xl text-white">
                        {{
                          straight: "↑",
                          "slight-right": "↗",
                          right: "→",
                          "sharp-right": "↘",
                          "slight-left": "↖",
                          left: "←",
                          "sharp-left": "↙",
                          "u-turn": "↩",
                        }[turnDirection.key] || "↑"}
                      </span>
                      <span className="text-white/80 text-sm">
                        {turnDirection.label}
                      </span>
                    </div>
                  )}

                  {/* Компас heading */}
                  {compass.heading != null && (
                    <div className="flex items-center gap-1 text-xs text-white/40">
                      <Compass className="h-3 w-3" />
                      <span>{Math.round(compass.heading)}°</span>
                      {compass.accuracy != null && compass.accuracy > 15 && (
                        <span className="text-amber-400/60">
                          (точность ±{Math.round(compass.accuracy)}°)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-white/50 text-sm">
                  {compass.heading == null
                    ? "Ожидание компаса..."
                    : !position
                    ? "Ожидание GPS..."
                    : "Нет целевой точки"}
                </div>
              )}
            </div>
          </div>

          {/* Компас не работает */}
          {compass.error && !compass.permissionNeeded && (
            <div className="absolute top-20 left-4 right-4 z-20 rounded-xl bg-red-500/20 backdrop-blur-sm px-3 py-2 text-center text-xs text-red-200 border border-red-400/30">
              {compass.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
