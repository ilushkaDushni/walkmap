"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_ICON = "/icons/icon-192x192.png";

export default function useNotification() {
  const [permission, setPermission] = useState("default");
  const registrationRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        registrationRef.current = reg;
      });
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    if (Notification.permission === "granted") {
      setPermission("granted");
      return "granted";
    }
    if (Notification.permission === "denied") {
      setPermission("denied");
      return "denied";
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const notify = useCallback((title, options = {}) => {
    if (permission !== "granted") return;
    const reg = registrationRef.current;
    if (!reg) return;

    const merged = {
      icon: DEFAULT_ICON,
      badge: DEFAULT_ICON,
      vibrate: [200, 100, 200],
      tag: "checkpoint",
      renotify: true,
      ...options,
    };

    reg.showNotification(title, merged).catch(() => {});
  }, [permission]);

  return { permission, requestPermission, notify };
}
