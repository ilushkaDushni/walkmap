"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { haversineDistance } from "@/lib/geo";

/**
 * Хук для срабатывания чекпоинтов и сегментов по GPS-приближению.
 *
 * @param {Object} params
 * @param {Object[]} params.checkpoints
 * @param {Object[]} params.segments
 * @param {Object|null} params.finish
 * @param {{ lat: number, lng: number }|null} params.userPosition
 */
export default function useCheckpointTrigger({ checkpoints = [], segments = [], finish = null, userPosition, onCheckpointTriggered, onFinishTriggered }) {
  const [triggeredIds, setTriggeredIds] = useState(new Set());
  const [activeCheckpoint, setActiveCheckpoint] = useState(null);
  const [finishReached, setFinishReached] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const [triggeredSegmentIds, setTriggeredSegmentIds] = useState(new Set());
  const [activeSegment, setActiveSegment] = useState(null);
  const audioRef = useRef(null);
  // Очередь чекпоинтов/сегментов, пойманных пока активен другой
  const pendingCheckpointsRef = useRef([]);
  const pendingSegmentsRef = useRef([]);

  const playAudio = useCallback((urls) => {
    if (!urls?.length) return;
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(urls[0]);
    audioRef.current.play().catch(() => {});
  }, []);

  // Автодисмисс: когда пользователь прошёл активный поинт (ушёл за пределы радиуса),
  // снимаем блокировку и разрешаем следующие триггеры
  useEffect(() => {
    if (!userPosition) return;

    if (activeCheckpoint) {
      const dist = haversineDistance(userPosition, activeCheckpoint.position);
      const radius = activeCheckpoint.triggerRadiusMeters || 20;
      if (dist > radius * 1.5) {
        setActiveCheckpoint(null);
        // Проверяем очередь — активируем следующий пендинг
        if (pendingCheckpointsRef.current.length > 0) {
          const next = pendingCheckpointsRef.current.shift();
          setActiveCheckpoint(next);
          playAudio(next.audio);
        }
      }
    }
    if (activeSegment) {
      const dist = haversineDistance(userPosition, activeSegment.position);
      const radius = activeSegment.triggerRadiusMeters || 30;
      if (dist > radius * 1.5) {
        setActiveSegment(null);
        if (pendingSegmentsRef.current.length > 0) {
          const next = pendingSegmentsRef.current.shift();
          setActiveSegment(next);
        }
      }
    }
  }, [userPosition, activeCheckpoint, activeSegment, playAudio]);

  useEffect(() => {
    if (!userPosition) return;

    // Проверяем чекпоинты
    for (const cp of checkpoints) {
      if (triggeredIds.has(cp.id)) continue;
      const dist = haversineDistance(userPosition, cp.position);
      if (dist <= (cp.triggerRadiusMeters || 20)) {
        setTriggeredIds((prev) => new Set([...prev, cp.id]));
        setTotalCoins((prev) => prev + (cp.coinsReward || 0));
        onCheckpointTriggered?.(cp, Math.round(dist));

        if (activeCheckpoint) {
          // Уже есть активный — добавляем в очередь вместо потери
          pendingCheckpointsRef.current.push(cp);
        } else {
          setActiveCheckpoint(cp);
          playAudio(cp.audio);
        }
        break; // один за раз
      }
    }

    // Проверяем сегменты
    for (const seg of segments) {
      if (triggeredSegmentIds.has(seg.id)) continue;
      const dist = haversineDistance(userPosition, seg.position);
      if (dist <= (seg.triggerRadiusMeters || 30)) {
        setTriggeredSegmentIds((prev) => new Set([...prev, seg.id]));

        if (activeSegment) {
          pendingSegmentsRef.current.push(seg);
        } else {
          setActiveSegment(seg);
        }
        break; // один за раз
      }
    }

    // Проверяем финиш — только если все чекпоинты собраны
    if (finish?.position && !finishReached) {
      const allCheckpointsTriggered = checkpoints.length === 0 ||
        checkpoints.every((cp) => triggeredIds.has(cp.id));

      if (allCheckpointsTriggered) {
        const dist = haversineDistance(userPosition, finish.position);
        if (dist <= 30) {
          setFinishReached(true);
          setTotalCoins((prev) => prev + (finish.coinsReward || 0));
          onFinishTriggered?.();
        }
      }
    }
  }, [userPosition, checkpoints, segments, finish, triggeredIds, triggeredSegmentIds, finishReached, activeCheckpoint, activeSegment, playAudio]);

  const dismissActiveCheckpoint = useCallback(() => {
    setActiveCheckpoint(null);
    // При ручном дисмиссе тоже проверяем очередь
    if (pendingCheckpointsRef.current.length > 0) {
      const next = pendingCheckpointsRef.current.shift();
      setActiveCheckpoint(next);
      playAudio(next.audio);
    }
  }, [playAudio]);

  const dismissActiveSegment = useCallback(() => {
    setActiveSegment(null);
    if (pendingSegmentsRef.current.length > 0) {
      const next = pendingSegmentsRef.current.shift();
      setActiveSegment(next);
    }
  }, []);

  const reset = useCallback(() => {
    setTriggeredIds(new Set());
    setActiveCheckpoint(null);
    setFinishReached(false);
    setTotalCoins(0);
    setTriggeredSegmentIds(new Set());
    setActiveSegment(null);
    pendingCheckpointsRef.current = [];
    pendingSegmentsRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return {
    triggeredIds,
    activeCheckpoint,
    finishReached,
    totalCoins,
    triggeredSegmentIds,
    activeSegment,
    dismissActiveCheckpoint,
    dismissActiveSegment,
    reset,
  };
}
