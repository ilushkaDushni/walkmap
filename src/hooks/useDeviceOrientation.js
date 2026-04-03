"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Хук для получения направления компаса (heading) устройства.
 *
 * Использует DeviceOrientationEvent (webkitCompassHeading на iOS, alpha на Android).
 * На iOS 13+ требуется явный запрос разрешения по клику пользователя.
 *
 * @returns {{
 *   heading: number | null,       — азимут в градусах (0 = север, 90 = восток)
 *   accuracy: number | null,      — точность компаса в градусах
 *   available: boolean,           — поддерживается ли компас
 *   permissionNeeded: boolean,    — нужен ли запрос разрешения (iOS)
 *   requestPermission: () => void — запросить разрешение (вызывать по клику!)
 *   error: string | null
 * }}
 */
export default function useDeviceOrientation() {
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [available, setAvailable] = useState(false);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);

  // Сглаживание heading (EMA)
  const smoothedRef = useRef(null);
  const SMOOTH = 0.3;

  // Определяем нужно ли разрешение (iOS 13+)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (typeof DeviceOrientationEvent === "undefined") {
      setError("Компас не поддерживается");
      return;
    }

    // iOS 13+ требует requestPermission
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      setPermissionNeeded(true);
      setAvailable(true);
    } else {
      // Android и старые iOS — сразу слушаем
      setAvailable(true);
      setListening(true);
    }
  }, []);

  // Запрос разрешения (iOS) — вызывать только по клику!
  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent === "undefined" ||
        typeof DeviceOrientationEvent.requestPermission !== "function") {
      setListening(true);
      return;
    }

    try {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result === "granted") {
        setPermissionNeeded(false);
        setListening(true);
        setError(null);
      } else {
        setError("Доступ к компасу запрещён");
      }
    } catch (err) {
      setError("Ошибка запроса разрешения компаса");
    }
  }, []);

  // Слушаем deviceorientation
  useEffect(() => {
    if (!listening) return;

    // Флаг: если absolute-компас доступен, игнорируем обычный deviceorientation
    // чтобы два обработчика не конфликтовали
    let hasAbsolute = false;

    const applyHeading = (newHeading) => {
      if (smoothedRef.current == null) {
        smoothedRef.current = newHeading;
      } else {
        let diff = newHeading - smoothedRef.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        smoothedRef.current = (smoothedRef.current + SMOOTH * diff + 360) % 360;
      }
      setHeading(Math.round(smoothedRef.current));
    };

    const handler = (event) => {
      // Если absolute-компас уже работает — пропускаем обычный
      if (hasAbsolute) return;

      let newHeading = null;

      // iOS: webkitCompassHeading (уже магнитный север, 0-360)
      if (event.webkitCompassHeading != null) {
        newHeading = event.webkitCompassHeading;
        if (event.webkitCompassAccuracy != null) {
          setAccuracy(event.webkitCompassAccuracy);
        }
      }
      // Android fallback: alpha
      else if (event.alpha != null) {
        newHeading = (360 - event.alpha) % 360;
      }

      if (newHeading != null) applyHeading(newHeading);
    };

    window.addEventListener("deviceorientation", handler, true);

    // deviceorientationabsolute (Chrome Android) — приоритетный источник
    const absHandler = (event) => {
      if (event.alpha == null) return;
      hasAbsolute = true;
      applyHeading((360 - event.alpha) % 360);
    };

    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", absHandler, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handler, true);
      if ("ondeviceorientationabsolute" in window) {
        window.removeEventListener("deviceorientationabsolute", absHandler, true);
      }
    };
  }, [listening]);

  return {
    heading,
    accuracy,
    available,
    permissionNeeded,
    requestPermission,
    error,
  };
}
