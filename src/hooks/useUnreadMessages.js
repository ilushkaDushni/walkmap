"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

const POLL_INTERVAL = 60_000;

export default function useUnreadMessages() {
  const { user, authFetch } = useUser();
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!user || !authFetch) return;
    try {
      const res = await authFetch("/api/messages/unread-total");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count);
      }
    } catch {
      // ignore
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    fetchCount();
    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);

    // SSE триггер — MessageToast диспатчит refresh-unread при получении сообщения
    const onRefresh = () => fetchCount();
    window.addEventListener("refresh-unread", onRefresh);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("refresh-unread", onRefresh);
    };
  }, [user, fetchCount]);

  return { count, refresh: fetchCount };
}
