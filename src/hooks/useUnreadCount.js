"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

const POLL_INTERVAL = 30_000; // 30 секунд

export default function useUnreadCount() {
  const { user, authFetch } = useUser();
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchCount = useCallback(async () => {
    if (!user || !authFetch) return;
    try {
      const res = await authFetch("/api/notifications/unread-count");
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

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchCount]);

  return { count, refresh: fetchCount };
}
