"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

const POLL_INTERVAL = 3000; // 3 сек

export default function useLobbyParticipant(lobbyId, { enabled = false } = {}) {
  const { authFetch } = useUser();
  const [lobbyState, setLobbyState] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const audioRef = useRef(null); // HTMLAudioElement reference for sync

  const fetchState = useCallback(async () => {
    if (!authFetch || !lobbyId) return;
    try {
      const res = await authFetch(`/api/lobbies/${lobbyId}`);
      if (res.ok) {
        const data = await res.json();
        setLobbyState(data);
        setError(null);

        // Синхронизация аудио
        if (data.hostState?.audio && audioRef.current) {
          syncAudio(data.hostState.audio);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка загрузки");
      }
    } catch {
      setError("Ошибка сети");
    }
  }, [authFetch, lobbyId]);

  const syncAudio = (hostAudio) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Play/Pause sync
    if (hostAudio.isPlaying && audio.paused) {
      audio.play().catch(() => {});
    } else if (!hostAudio.isPlaying && !audio.paused) {
      audio.pause();
    }

    // Time drift correction (±2 сек допуск)
    if (hostAudio.isPlaying) {
      const serverUpdatedAt = new Date(hostAudio.updatedAt).getTime();
      const elapsed = (Date.now() - serverUpdatedAt) / 1000;
      const expectedTime = hostAudio.currentTime + elapsed;
      const drift = Math.abs(audio.currentTime - expectedTime);

      if (drift > 2) {
        audio.currentTime = expectedTime;
      }
    }
  };

  useEffect(() => {
    if (!enabled || !lobbyId) return;

    fetchState();
    intervalRef.current = setInterval(fetchState, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, lobbyId, fetchState]);

  const leaveLobby = useCallback(async () => {
    if (!authFetch || !lobbyId) return false;
    try {
      const res = await authFetch(`/api/lobbies/${lobbyId}/leave`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }, [authFetch, lobbyId]);

  return {
    lobbyState,
    error,
    audioRef,
    leaveLobby,
    refresh: fetchState,
  };
}
