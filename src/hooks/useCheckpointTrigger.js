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
      }
    }
    if (activeSegment) {
      const dist = haversineDistance(userPosition, activeSegment.position);
      const radius = activeSegment.triggerRadiusMeters || 30;
      if (dist > radius * 1.5) {
        setActiveSegment(null);
      }
    }
  }, [userPosition, activeCheckpoint, activeSegment]);

  useEffect(() => {
    if (!userPosition) return;

    // Блокируем новые триггеры пока есть активный (непройденный) чекпоинт/сегмент
    if (activeCheckpoint || activeSegment) return;

    // Проверяем чекпоинты
    for (const cp of checkpoints) {
      if (triggeredIds.has(cp.id)) continue;
      const dist = haversineDistance(userPosition, cp.position);
      if (dist <= (cp.triggerRadiusMeters || 20)) {
        setTriggeredIds((prev) => new Set([...prev, cp.id]));
        setActiveCheckpoint(cp);
        setTotalCoins((prev) => prev + (cp.coinsReward || 0));
        playAudio(cp.audio);
        onCheckpointTriggered?.(cp, Math.round(dist));
        break; // один за раз
      }
    }

    // Проверяем сегменты
    for (const seg of segments) {
      if (triggeredSegmentIds.has(seg.id)) continue;
      const dist = haversineDistance(userPosition, seg.position);
      if (dist <= (seg.triggerRadiusMeters || 30)) {
        setTriggeredSegmentIds((prev) => new Set([...prev, seg.id]));
        setActiveSegment(seg);
        break; // один за раз
      }
    }

    // Проверяем финиш (не блокируется — финиш всегда срабатывает)
    if (finish?.position && !finishReached) {
      const dist = haversineDistance(userPosition, finish.position);
      if (dist <= 30) {
        setFinishReached(true);
        setTotalCoins((prev) => prev + (finish.coinsReward || 0));
        onFinishTriggered?.();
      }
    }
  }, [userPosition, checkpoints, segments, finish, triggeredIds, triggeredSegmentIds, finishReached, activeCheckpoint, activeSegment, playAudio]);

  const dismissActiveCheckpoint = useCallback(() => {
    setActiveCheckpoint(null);
  }, []);

  const dismissActiveSegment = useCallback(() => {
    setActiveSegment(null);
  }, []);

  const reset = useCallback(() => {
    setTriggeredIds(new Set());
    setActiveCheckpoint(null);
    setFinishReached(false);
    setTotalCoins(0);
    setTriggeredSegmentIds(new Set());
    setActiveSegment(null);
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
