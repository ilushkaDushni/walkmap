"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { haversineDistance } from "@/lib/geo";

/**
 * Хук для срабатывания чекпоинтов по GPS-приближению.
 *
 * @param {Object} params
 * @param {Object[]} params.checkpoints
 * @param {Object|null} params.finish
 * @param {{ lat: number, lng: number }|null} params.userPosition
 */
export default function useCheckpointTrigger({ checkpoints = [], finish = null, userPosition }) {
  const [triggeredIds, setTriggeredIds] = useState(new Set());
  const [activeCheckpoint, setActiveCheckpoint] = useState(null);
  const [finishReached, setFinishReached] = useState(false);
  const [totalCoins, setTotalCoins] = useState(0);
  const audioRef = useRef(null);

  const playAudio = useCallback((urls) => {
    if (!urls?.length) return;
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(urls[0]);
    audioRef.current.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (!userPosition) return;

    // Проверяем чекпоинты
    for (const cp of checkpoints) {
      if (triggeredIds.has(cp.id)) continue;
      const dist = haversineDistance(userPosition, cp.position);
      if (dist <= (cp.triggerRadiusMeters || 20)) {
        setTriggeredIds((prev) => new Set([...prev, cp.id]));
        setActiveCheckpoint(cp);
        setTotalCoins((prev) => prev + (cp.coinsReward || 0));
        playAudio(cp.audio);
        break; // один за раз
      }
    }

    // Проверяем финиш
    if (finish?.position && !finishReached) {
      const dist = haversineDistance(userPosition, finish.position);
      if (dist <= 30) {
        setFinishReached(true);
        setTotalCoins((prev) => prev + (finish.coinsReward || 0));
      }
    }
  }, [userPosition, checkpoints, finish, triggeredIds, finishReached, playAudio]);

  return { triggeredIds, activeCheckpoint, finishReached, totalCoins };
}
