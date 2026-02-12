"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

const PUSH_INTERVAL = 3000; // 3 сек

export default function useLobbyHost(lobbyId, { enabled = false } = {}) {
  const { authFetch } = useUser();
  const intervalRef = useRef(null);
  const positionRef = useRef(null);
  const audioRef = useRef({ isPlaying: false, trackIndex: 0, currentTime: 0 });
  const progressRef = useRef(0);
  const checkpointsRef = useRef([]);
  const totalCoinsRef = useRef(0);

  const pushState = useCallback(async () => {
    if (!authFetch || !lobbyId) return;
    try {
      await authFetch(`/api/lobbies/${lobbyId}/host-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: positionRef.current,
          progress: progressRef.current,
          triggeredCheckpointIds: checkpointsRef.current,
          totalCoins: totalCoinsRef.current,
          audio: audioRef.current,
        }),
      });
    } catch {
      // ignore
    }
  }, [authFetch, lobbyId]);

  useEffect(() => {
    if (!enabled || !lobbyId) return;

    intervalRef.current = setInterval(pushState, PUSH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, lobbyId, pushState]);

  const updatePosition = useCallback((pos) => {
    positionRef.current = pos;
  }, []);

  const updateAudio = useCallback((audio) => {
    audioRef.current = audio;
  }, []);

  const updateProgress = useCallback((progress) => {
    progressRef.current = progress;
  }, []);

  const updateCheckpoints = useCallback((ids) => {
    checkpointsRef.current = ids;
  }, []);

  const updateTotalCoins = useCallback((coins) => {
    totalCoinsRef.current = coins;
  }, []);

  const startLobby = useCallback(async () => {
    if (!authFetch || !lobbyId) return false;
    try {
      const res = await authFetch(`/api/lobbies/${lobbyId}/start`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }, [authFetch, lobbyId]);

  const completeLobby = useCallback(async () => {
    if (!authFetch || !lobbyId) return null;
    try {
      const res = await authFetch(`/api/lobbies/${lobbyId}/complete`, { method: "POST" });
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
    return null;
  }, [authFetch, lobbyId]);

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
    updatePosition,
    updateAudio,
    updateProgress,
    updateCheckpoints,
    updateTotalCoins,
    startLobby,
    completeLobby,
    leaveLobby,
    pushState,
  };
}
