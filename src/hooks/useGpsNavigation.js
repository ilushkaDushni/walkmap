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
} from "@/lib/geo";

const SMOOTH_FACTOR = 0.5; // EMA: 0 = игнорировать новые, 1 = без сглаживания

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

  // Блокировка обратного хода
  const maxProgressRef = useRef(0);
  const [projection, setProjection] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [passedCoords, setPassedCoords] = useState([]);
  const [remainingCoords, setRemainingCoords] = useState([]);

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

  // Обновляем проекцию при изменении сглаженной позиции (с дебаунсом)
  const debounceRef = useRef(null);
  useEffect(() => {
    if (!active || !smoothedPosition || dirPath.length < 2) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const proj = projectPointOnPath(smoothedPosition, dirPath);
      if (!proj) return;

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
    }, 800);

    return () => clearTimeout(debounceRef.current);
  }, [active, smoothedPosition, dirPath, cumDist]);

  const startGps = useCallback(() => {
    maxProgressRef.current = 0;
    smoothedRef.current = null;
    setSmoothedPosition(null);
    setProgress(0);
    setProjection(null);
    setIsOffRoute(false);
    setPassedCoords([]);
    setRemainingCoords([]);
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
    resetTrigger();
  }, [stopTracking, resetTrigger]);

  const dismissEvent = useCallback(() => {
    dismissActiveCheckpoint();
    dismissActiveSegment();
  }, [dismissActiveCheckpoint, dismissActiveSegment]);

  const distanceRemaining = totalDistance > 0 ? totalDistance * (1 - progress) : 0;

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
    startGps,
    stopGps,
    wakeLockFailed: wakeLock.failed,
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
