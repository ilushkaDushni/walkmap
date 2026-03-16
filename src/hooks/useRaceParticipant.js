"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

const GPS_PUSH_INTERVAL = 3000; // 3 сек
const GPS_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 10000,
};

/**
 * Хук для участника гонки.
 * GPS → пушит позицию на сервер каждые 3с.
 * Сервер вычисляет progress.
 */
export default function useRaceParticipant(lobbyId, { enabled = false } = {}) {
  const { authFetch } = useUser();
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const positionRef = useRef(null);

  // Push position to server
  const pushPosition = useCallback(async () => {
    if (!authFetch || !lobbyId || !positionRef.current) return;
    try {
      await authFetch(`/api/lobbies/${lobbyId}/participant-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: positionRef.current,
        }),
      });
    } catch {}
  }, [authFetch, lobbyId]);

  // Finish race
  const finishRace = useCallback(async () => {
    if (!authFetch || !lobbyId || !positionRef.current) return null;
    try {
      const res = await authFetch(`/api/lobbies/${lobbyId}/finish-race`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: positionRef.current }),
      });
      if (res.ok) return await res.json();
      const data = await res.json();
      return { error: data.error };
    } catch {
      return { error: "Ошибка сети" };
    }
  }, [authFetch, lobbyId]);

  useEffect(() => {
    if (!enabled || !lobbyId) return;

    // Start GPS watch
    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          positionRef.current = p;
          setPosition(p);
          setError(null);
        },
        (err) => {
          setError(err.message);
        },
        GPS_OPTIONS
      );
    } else {
      setError("Геолокация недоступна");
    }

    // Push interval
    intervalRef.current = setInterval(pushPosition, GPS_PUSH_INTERVAL);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, lobbyId, pushPosition]);

  return {
    position,
    error,
    finishRace,
  };
}
