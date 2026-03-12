"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useUserLocation from "./useUserLocation";
import { haversineDistance } from "@/lib/geo";
import { useUser } from "@/components/UserProvider";

const BATCH_INTERVAL = 10000; // Отправка точек на сервер каждые 10 сек
const MIN_DISTANCE = 3; // Минимальное расстояние между точками (метры)

/**
 * Хук для записи GPS-трека.
 *
 * @param {{ routeId?: string }} options
 * @returns {{ isRecording, trackId, distance, duration, points, startRecording, stopRecording, error }}
 */
export default function useGpsTracker({ routeId } = {}) {
  const { authFetch } = useUser();
  const { position, accuracy, status: gpsStatus, startTracking, stopTracking } = useUserLocation();

  const [isRecording, setIsRecording] = useState(false);
  const [trackId, setTrackId] = useState(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const pointsBufferRef = useRef([]); // Точки для отправки на сервер
  const allPointsRef = useRef([]); // Все записанные точки (локально)
  const lastPointRef = useRef(null);
  const batchTimerRef = useRef(null);
  const durationTimerRef = useRef(null);
  const startTimeRef = useRef(null);
  const trackIdRef = useRef(null);

  // Отправка буфера точек на сервер
  const flushPoints = useCallback(async () => {
    const id = trackIdRef.current;
    if (!authFetch || !id || pointsBufferRef.current.length === 0) return;

    const points = [...pointsBufferRef.current];
    pointsBufferRef.current = [];

    try {
      const res = await authFetch(`/api/gps-tracks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (res.ok) {
        const data = await res.json();
        setDistance(data.distance);
      }
    } catch {
      // Вернуть точки в буфер при ошибке
      pointsBufferRef.current = [...points, ...pointsBufferRef.current];
    }
  }, [authFetch]);

  // Добавление новой GPS-точки
  useEffect(() => {
    if (!isRecording || !position) return;

    const last = lastPointRef.current;
    if (last) {
      const dist = haversineDistance(last, position);
      if (dist < MIN_DISTANCE) return; // Фильтруем джиттер
    }

    const point = {
      lat: position.lat,
      lng: position.lng,
      timestamp: new Date().toISOString(),
    };

    lastPointRef.current = position;
    pointsBufferRef.current.push(point);
    allPointsRef.current.push(point);

    // Обновляем локальное расстояние
    if (last) {
      const d = haversineDistance(last, position);
      setDistance((prev) => prev + d);
    }
  }, [isRecording, position]);

  // Таймер отправки батча
  useEffect(() => {
    if (isRecording) {
      batchTimerRef.current = setInterval(flushPoints, BATCH_INTERVAL);
      return () => clearInterval(batchTimerRef.current);
    }
  }, [isRecording, flushPoints]);

  // Таймер длительности
  useEffect(() => {
    if (isRecording && startTimeRef.current) {
      durationTimerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      return () => clearInterval(durationTimerRef.current);
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!authFetch) return;
    setError(null);

    startTracking();

    try {
      const res = await authFetch("/api/gps-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: routeId || null,
          startPosition: position || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      const data = await res.json();
      trackIdRef.current = data.trackId;
      setTrackId(data.trackId);
      setIsRecording(true);
      setDistance(0);
      setDuration(0);
      startTimeRef.current = Date.now();
      pointsBufferRef.current = [];
      allPointsRef.current = [];
      lastPointRef.current = position || null;
    } catch {
      setError("Ошибка при начале записи");
    }
  }, [authFetch, routeId, position, startTracking]);

  const stopRecording = useCallback(async () => {
    if (!authFetch || !trackIdRef.current) return null;

    // Отправляем оставшиеся точки
    await flushPoints();

    try {
      const res = await authFetch(`/api/gps-tracks/${trackIdRef.current}/finish`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setIsRecording(false);
        stopTracking();
        clearInterval(batchTimerRef.current);
        clearInterval(durationTimerRef.current);

        const result = {
          trackId: trackIdRef.current,
          distance: data.distance,
          duration: data.duration,
          pointsCount: data.pointsCount,
        };

        trackIdRef.current = null;
        setTrackId(null);
        startTimeRef.current = null;

        return result;
      }
    } catch {
      setError("Ошибка при завершении записи");
    }
    return null;
  }, [authFetch, flushPoints, stopTracking]);

  const [pointsCount, setPointsCount] = useState(0);

  // Обновляем счётчик при добавлении точки
  useEffect(() => {
    if (!isRecording || !position) return;
    setPointsCount(allPointsRef.current.length);
  }, [isRecording, position]);

  return {
    isRecording,
    trackId,
    distance,
    duration,
    gpsStatus,
    position,
    accuracy,
    pointsCount,
    startRecording,
    stopRecording,
    error,
  };
}
