"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Хук для отслеживания GPS-позиции пользователя.
 *
 * @returns {{
 *   position: { lat: number, lng: number } | null,
 *   accuracy: number | null,
 *   status: 'idle' | 'watching' | 'denied' | 'unavailable' | 'error',
 *   startTracking: () => void,
 *   stopTracking: () => void,
 * }}
 */
export default function useUserLocation() {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | watching | denied | unavailable | error
  const watchIdRef = useRef(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus("idle");
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    setStatus("watching");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setAccuracy(pos.coords.accuracy);
        setStatus("watching");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
        } else {
          setStatus("error");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );
  }, []);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, accuracy, status, startTracking, stopTracking };
}
