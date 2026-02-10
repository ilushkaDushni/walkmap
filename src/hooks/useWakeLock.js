"use client";

import { useEffect, useRef } from "react";

/**
 * Не даёт экрану гаснуть пока active === true.
 * Использует Screen Wake Lock API. Тихо игнорирует если не поддерживается.
 */
export default function useWakeLock(active) {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!active) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    if (!("wakeLock" in navigator)) return;

    let released = false;

    const request = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Браузер отклонил запрос — ничего не делаем
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
  }, [active]);
}
