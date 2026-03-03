"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/components/UserProvider";

export default function useNotificationSSE(onEvent) {
  const { user } = useUser();
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!user) return;

    let es;
    let reconnectTimer;

    const connect = () => {
      es = new EventSource("/api/notifications/stream");

      es.onopen = () => {
        window.dispatchEvent(new Event("sse-connected"));
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callbackRef.current?.(data);
        } catch {
          // ignore non-JSON (ping/comments)
        }
      };

      es.onerror = () => {
        window.dispatchEvent(new Event("sse-disconnected"));
        es.close();
        // Переподключаемся через 5с
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [user]);
}
