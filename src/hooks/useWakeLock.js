"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Не даёт экрану гаснуть пока active === true.
 * Использует Screen Wake Lock API.
 * Возвращает { supported, failed } для отображения предупреждения в UI.
 */
export default function useWakeLock(active) {
  const wakeLockRef = useRef(null);
  const [supported] = useState(() => typeof navigator !== "undefined" && "wakeLock" in navigator);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      setFailed(false);
      return;
    }

    if (!supported) return;

    let released = false;

    const request = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        setFailed(false);
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        setFailed(true);
      }
    };

    request();

    // Спецификация: wake lock сбрасывается при переключении вкладки,
    // нужно перезапросить при возврате
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) {
        request();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [active, supported]);

  return { supported, failed };
}
