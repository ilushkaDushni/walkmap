"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useUserLocation from "./useUserLocation";
import useCheckpointTrigger from "./useCheckpointTrigger";
import useWakeLock from "./useWakeLock";
import {
  projectPointOnPath,
  cumulativeDistances,
  progressFromProjection,
  splitPathAtProjection,
  getDirectedPath,
  remapSegmentsForDirectedPath,
  buildRouteEvents,
  distanceAlongPath,
  calculateBearing,
  getTurnDirection,
  haversineDistance,
} from "@/lib/geo";

const SMOOTH_FACTOR = 0.5; // EMA: 0 = игнорировать новые, 1 = без сглаживания
const DETOUR_RETURN_THRESHOLD = 40; // метров — считаем что вернулся на маршрут

/**
 * Центральный хук GPS-навигации.
 *
 * @param {{ route: Object, active: boolean }}
 * active — хук работает только когда true (GPS-режим включён)
 */
export default function useGpsNavigation({ route, active, onCheckpointTriggered, onFinishTriggered }) {
  const { position: rawPosition, accuracy, status: gpsStatus, startTracking, stopTracking } = useUserLocation();

  // Сглаживание позиции (EMA)
  const smoothedRef = useRef(null);
  const [smoothedPosition, setSmoothedPosition] = useState(null);

  useEffect(() => {
    if (!active || !rawPosition) return;

    if (!smoothedRef.current) {
      // Первая позиция — принимаем как есть
      smoothedRef.current = { ...rawPosition };
    } else {
      smoothedRef.current = {
        lat: smoothedRef.current.lat + SMOOTH_FACTOR * (rawPosition.lat - smoothedRef.current.lat),
        lng: smoothedRef.current.lng + SMOOTH_FACTOR * (rawPosition.lng - smoothedRef.current.lng),
      };
    }
    setSmoothedPosition({ ...smoothedRef.current });
  }, [active, rawPosition]);

  // Время старта навигации (для рекордов)
  const [startedAt, setStartedAt] = useState(null);

  // Блокировка обратного хода
  const maxProgressRef = useRef(0);
  const [projection, setProjection] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [passedCoords, setPassedCoords] = useState([]);
  const [remainingCoords, setRemainingCoords] = useState([]);

  // Режим перекуса / отклонения
  const [detourMode, setDetourMode] = useState(false);
  const [detourDistance, setDetourDistance] = useState(0); // расстояние до ближайшей точки маршрута
  const [detourBearing, setDetourBearing] = useState(0); // направление обратно к маршруту
  const detourStartTimeRef = useRef(null);

  // Расширенный детур: маршрут к заведению
  const [detourTarget, setDetourTarget] = useState(null); // { lat, lng, name, ... }
  const [detourPath, setDetourPath] = useState(null); // GeoJSON LineString к заведению
  const [detourReturnPath, setDetourReturnPath] = useState(null); // GeoJSON LineString возврат
  const [detourReturnPoint, setDetourReturnPoint] = useState(null); // { lat, lng } точка возврата на маршрут
  const [detourPhase, setDetourPhase] = useState("idle"); // idle | going | returning
  const DETOUR_TARGET_THRESHOLD = 30; // метров — считаем что дошёл до заведения
  const DETOUR_RETURN_THRESHOLD_EXT = 40; // метров — вернулся на маршрут

  const wakeLock = useWakeLock(active);

  const rawPath = route?.path || [];
  const checkpoints = route?.checkpoints || [];
  const segments = route?.segments || [];
  const finish = route?.finish || null;

  // Directed path: от старта к финишу
  const { dirPath, reversed, offset } = useMemo(
    () => getDirectedPath(rawPath, route?.startPointIndex, route?.finishPointIndex),
    [rawPath, route?.startPointIndex, route?.finishPointIndex]
  );

  const cumDist = useMemo(() => cumulativeDistances(dirPath), [dirPath]);
  const totalDistance = cumDist.length > 0 ? cumDist[cumDist.length - 1] : 0;

  // Сегменты с позициями для useCheckpointTrigger (ремаппим на dirPath)
  const dirSegments = useMemo(
    () => remapSegmentsForDirectedPath(segments, offset, reversed, dirPath.length),
    [segments, offset, reversed, dirPath.length]
  );

  const segmentsWithPositions = useMemo(() => {
    return dirSegments.map((seg) => {
      if (seg.position) return seg;
      const i = seg.pathIndex;
      if (i != null && i >= 0 && i < dirPath.length) {
        return { ...seg, position: { lat: dirPath[i].lat, lng: dirPath[i].lng } };
      }
      return seg;
    });
  }, [dirSegments, dirPath]);

  // Для триггеров используем raw-позицию (точнее для определения радиуса),
  // для визуала — сглаженную
  const {
    triggeredIds,
    activeCheckpoint,
    finishReached,
    totalCoins,
    triggeredSegmentIds,
    activeSegment,
    dismissActiveCheckpoint,
    dismissActiveSegment,
    reset: resetTrigger,
  } = useCheckpointTrigger({
    checkpoints,
    segments: segmentsWithPositions,
    finish,
    userPosition: active ? rawPosition : null,
    onCheckpointTriggered,
    onFinishTriggered,
  });

  // Обновляем проекцию при изменении сглаженной позиции (throttle вместо debounce)
  const lastProjectionUpdateRef = useRef(0);
  const throttleRef = useRef(null);
  const PROJECTION_THROTTLE_MS = 500;

  useEffect(() => {
    if (!active || !smoothedPosition || dirPath.length < 2) return;

    const doUpdate = () => {
      lastProjectionUpdateRef.current = Date.now();

      const proj = projectPointOnPath(smoothedPosition, dirPath);
      if (!proj) return;

      // В режиме перекуса — обновляем расстояние/направление, но НЕ двигаем прогресс
      if (detourMode) {
        setDetourDistance(proj.distance);
        const nearestPoint = proj.position || dirPath[proj.pathIndex];
        if (nearestPoint) {
          setDetourBearing(calculateBearing(smoothedPosition, nearestPoint));
        }

        // Расширенный детур с целью
        if (detourTarget) {
          const distToTarget = haversineDistance(smoothedPosition, detourTarget);

          if (detourPhase === "going") {
            if (distToTarget <= DETOUR_TARGET_THRESHOLD) {
              setDetourPhase("returning");
            }
          } else if (detourPhase === "returning") {
            if (proj.distance <= DETOUR_RETURN_THRESHOLD_EXT) {
              exitDetourFull();
            }
          }
        } else {
          // Простой детур (без цели) — автовозврат при приближении к маршруту
          if (proj.distance <= DETOUR_RETURN_THRESHOLD) {
            setDetourMode(false);
            detourStartTimeRef.current = null;
          }
        }
        return;
      }

      setProjection(proj);
      setIsOffRoute(proj.distance > 50);

      const rawProgress = progressFromProjection(proj, cumDist);
      // Блокировка обратного хода — GPS-джиттер не «раз-серит» пройденные участки
      const clamped = Math.max(maxProgressRef.current, rawProgress);
      maxProgressRef.current = clamped;
      setProgress(clamped);

      // Разделяем путь по зафиксированному прогрессу
      const clampedProjection = clamped === rawProgress
        ? proj
        : progressToProjection(clamped, cumDist, dirPath);

      const { passed, remaining } = splitPathAtProjection(dirPath, clampedProjection);
      setPassedCoords(passed);
      setRemainingCoords(remaining);
    };

    const elapsed = Date.now() - lastProjectionUpdateRef.current;
    if (elapsed >= PROJECTION_THROTTLE_MS) {
      // Достаточно времени прошло — обновляем сразу
      doUpdate();
    } else {
      // Ещё рано — планируем на оставшееся время (trailing edge)
      if (throttleRef.current) clearTimeout(throttleRef.current);
      throttleRef.current = setTimeout(doUpdate, PROJECTION_THROTTLE_MS - elapsed);
    }

    return () => { if (throttleRef.current) clearTimeout(throttleRef.current); };
  }, [active, smoothedPosition, dirPath, cumDist, detourMode, detourTarget, detourPhase]);

  const startDetour = useCallback(() => {
    setDetourMode(true);
    detourStartTimeRef.current = Date.now();
  }, []);

  const stopDetour = useCallback(() => {
    setDetourMode(false);
    detourStartTimeRef.current = null;
  }, []);

  /**
   * Найти ближайшую точку маршрута ВПЕРЕДИ текущей позиции для возврата.
   * Ищем точку минимум на 100м вперёд по маршруту (чтобы не вернуться на ту же точку).
   */
  const findReturnPoint = useCallback(() => {
    if (!dirPath.length || !smoothedPosition) return null;
    const proj = projectPointOnPath(smoothedPosition, dirPath);
    if (!proj) return dirPath[0];

    // Расстояние от начала пути до текущей проекции
    const pi = Math.min(proj.pathIndex, cumDist.length - 2);
    const currentDist = cumDist[pi] +
      proj.fraction * (cumDist[pi + 1] - cumDist[pi]);
    const targetDist = currentDist + 100; // минимум 100м вперёд

    // Ищем первую точку пути которая дальше targetDist
    for (let i = proj.pathIndex + 1; i < dirPath.length; i++) {
      if (cumDist[i] >= targetDist) {
        return { lat: dirPath[i].lat, lng: dirPath[i].lng };
      }
    }

    // Если маршрут кончается раньше — берём последнюю точку
    const last = dirPath[dirPath.length - 1];
    return { lat: last.lat, lng: last.lng };
  }, [dirPath, smoothedPosition, cumDist]);

  /**
   * Начать детур с целью (маршрут к заведению).
   * @param {{ lat, lng, name }} target — заведение
   * @param {{ path, distance, duration }} routeToPlace — маршрут до заведения
   * @param {{ path, distance, duration }} routeBack — маршрут возврата
   * @param {{ lat, lng }} returnPt — точка возврата на основной маршрут
   */
  const startDetourWithTarget = useCallback((target, routeToPlace, routeBack, returnPt) => {
    setDetourMode(true);
    setDetourTarget(target);
    setDetourPhase("going");
    detourStartTimeRef.current = Date.now();

    // GeoJSON для линии к заведению
    if (routeToPlace?.path?.length >= 2) {
      setDetourPath({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: routeToPlace.path.map((p) => [p.lng, p.lat]),
        },
        properties: { distance: routeToPlace.distance, duration: routeToPlace.duration },
      });
    }

    // GeoJSON для линии возврата
    if (routeBack?.path?.length >= 2) {
      setDetourReturnPath({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: routeBack.path.map((p) => [p.lng, p.lat]),
        },
        properties: { distance: routeBack.distance, duration: routeBack.duration },
      });
    }

    if (returnPt) setDetourReturnPoint(returnPt);
  }, []);

  /**
   * Полный выход из расширенного детура.
   */
  const exitDetourFull = useCallback(() => {
    setDetourMode(false);
    setDetourTarget(null);
    setDetourPath(null);
    setDetourReturnPath(null);
    setDetourReturnPoint(null);
    setDetourPhase("idle");
    detourStartTimeRef.current = null;
  }, []);

  const startGps = useCallback(() => {
    maxProgressRef.current = 0;
    smoothedRef.current = null;
    setSmoothedPosition(null);
    setProgress(0);
    setProjection(null);
    setIsOffRoute(false);
    setPassedCoords([]);
    setRemainingCoords([]);
    setDetourMode(false);
    setDetourDistance(0);
    setDetourBearing(0);
    setDetourTarget(null);
    setDetourPath(null);
    setDetourReturnPath(null);
    setDetourReturnPoint(null);
    setDetourPhase("idle");
    detourStartTimeRef.current = null;
    setStartedAt(new Date());
    resetTrigger();
    startTracking();
  }, [startTracking, resetTrigger]);

  const stopGps = useCallback(() => {
    stopTracking();
    maxProgressRef.current = 0;
    smoothedRef.current = null;
    setSmoothedPosition(null);
    setProgress(0);
    setProjection(null);
    setIsOffRoute(false);
    setPassedCoords([]);
    setRemainingCoords([]);
    setDetourMode(false);
    setDetourDistance(0);
    setDetourBearing(0);
    setDetourTarget(null);
    setDetourPath(null);
    setDetourReturnPath(null);
    setDetourReturnPoint(null);
    setDetourPhase("idle");
    detourStartTimeRef.current = null;
    setStartedAt(null);
    resetTrigger();
  }, [stopTracking, resetTrigger]);

  const dismissEvent = useCallback(() => {
    dismissActiveCheckpoint();
    dismissActiveSegment();
  }, [dismissActiveCheckpoint, dismissActiveSegment]);

  const distanceRemaining = totalDistance > 0 ? totalDistance * (1 - progress) : 0;

  // === Навигационная подсказка: следующее событие + расстояние + поворот ===
  const dirEvents = useMemo(
    () => buildRouteEvents(dirPath, checkpoints, dirSegments, finish),
    [dirPath, checkpoints, dirSegments, finish]
  );

  const navigationHint = useMemo(() => {
    if (!projection || dirPath.length < 2 || dirEvents.length === 0) {
      return { nextEvent: null, distanceToNext: 0, turnDirection: null };
    }

    const userSortKey = projection.pathIndex + projection.fraction;

    // Находим первое событие checkpoint/finish, которое впереди пользователя
    let next = null;
    for (const ev of dirEvents) {
      if (ev.type !== "checkpoint" && ev.type !== "finish") continue;
      if (ev.sortKey > userSortKey) {
        next = ev;
        break;
      }
    }

    if (!next) {
      return { nextEvent: null, distanceToNext: 0, turnDirection: null };
    }

    // Проекция следующего события на путь
    let nextProjection;
    if (next.type === "finish" && next.data?.position) {
      nextProjection = projectPointOnPath(next.data.position, dirPath);
    } else if (next.type === "checkpoint" && next.data?.position) {
      nextProjection = projectPointOnPath(next.data.position, dirPath);
    }

    if (!nextProjection) {
      return { nextEvent: next, distanceToNext: 0, turnDirection: null };
    }

    const dist = distanceAlongPath(projection, nextProjection, cumDist);

    // Направление поворота: bearing текущего сегмента → bearing к следующей точке
    let turn = null;
    const i = projection.pathIndex;
    if (i < dirPath.length - 1) {
      const bearingCurrent = calculateBearing(dirPath[i], dirPath[i + 1]);
      // Для поворота берём bearing от точки перед чекпоинтом к точке после
      const ni = nextProjection.pathIndex;
      if (ni < dirPath.length - 1 && ni + 1 < dirPath.length) {
        // Bearing входящего сегмента и исходящего от чекпоинта
        const bearingInto = calculateBearing(dirPath[ni], dirPath[ni + 1]);
        const bearingOut = ni + 1 < dirPath.length - 1
          ? calculateBearing(dirPath[ni + 1], dirPath[ni + 2])
          : bearingInto;
        turn = getTurnDirection(bearingInto, bearingOut);
      } else {
        // Последний сегмент — прямо к финишу
        turn = { key: "straight", label: "прямо", angle: 0 };
      }
    }

    return { nextEvent: next, distanceToNext: dist, turnDirection: turn };
  }, [projection, dirPath, dirEvents, cumDist]);

  // GeoJSON для слоёв карты
  const passedGeoJson = useMemo(() => {
    if (passedCoords.length < 2) return null;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: passedCoords },
    };
  }, [passedCoords]);

  const remainingGeoJson = useMemo(() => {
    if (remainingCoords.length < 2) return null;
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: remainingCoords },
    };
  }, [remainingCoords]);

  return {
    position: smoothedPosition,
    rawPosition,
    accuracy,
    gpsStatus,
    projection,
    progress,
    distanceRemaining,
    isOffRoute,
    passedGeoJson,
    remainingGeoJson,
    activeCheckpoint,
    activeSegment,
    finishReached,
    totalCoins,
    triggeredIds,
    triggeredSegmentIds,
    dismissEvent,
    startedAt,
    startGps,
    stopGps,
    wakeLockFailed: wakeLock.failed,
    nextEvent: navigationHint.nextEvent,
    distanceToNext: navigationHint.distanceToNext,
    turnDirection: navigationHint.turnDirection,
    // Режим перекуса
    detourMode,
    detourDistance,
    detourBearing,
    startDetour,
    stopDetour,
    // Расширенный детур
    detourTarget,
    detourPath,
    detourReturnPath,
    detourReturnPoint,
    detourPhase,
    startDetourWithTarget,
    exitDetourFull,
    findReturnPoint,
  };
}

/**
 * Обратное преобразование: из прогресса (0-1) в projection { pathIndex, fraction }.
 */
function progressToProjection(progress, cumDist, path) {
  if (!cumDist || cumDist.length < 2) return { pathIndex: 0, fraction: 0 };
  const total = cumDist[cumDist.length - 1];
  const targetDist = progress * total;

  for (let i = 0; i < cumDist.length - 1; i++) {
    if (cumDist[i + 1] >= targetDist) {
      const edgeDist = cumDist[i + 1] - cumDist[i];
      const fraction = edgeDist > 0 ? (targetDist - cumDist[i]) / edgeDist : 0;
      return { pathIndex: i, fraction: Math.min(1, fraction) };
    }
  }

  return { pathIndex: path.length - 2, fraction: 1 };
}
