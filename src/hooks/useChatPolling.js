"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

export default function useChatPolling(conversationKey, { interval = 5000, enabled = true } = {}) {
  const { authFetch } = useUser();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const lastFetchRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!authFetch || !conversationKey) return;
    try {
      const res = await authFetch(`/api/messages/${conversationKey}?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch, conversationKey]);

  const markRead = useCallback(async () => {
    if (!authFetch || !conversationKey) return;
    try {
      await authFetch(`/api/messages/${conversationKey}/read`, { method: "PATCH" });
    } catch {
      // ignore
    }
  }, [authFetch, conversationKey]);

  useEffect(() => {
    if (!enabled || !conversationKey) return;

    fetchMessages().then(() => markRead());

    intervalRef.current = setInterval(() => {
      fetchMessages().then(() => markRead());
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, conversationKey, interval, fetchMessages, markRead]);

  const sendMessage = useCallback(async (text, routeId = null, replyToId = null) => {
    if (!authFetch || !conversationKey) return null;
    try {
      const res = await authFetch(`/api/messages/${conversationKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, routeId, replyToId }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        return msg;
      }
    } catch {
      // ignore
    }
    return null;
  }, [authFetch, conversationKey]);

  const deleteMessage = useCallback(async (messageId, mode = "all") => {
    if (!authFetch || !conversationKey) return false;
    try {
      const res = await authFetch(`/api/messages/${conversationKey}/${messageId}?mode=${mode}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (mode === "all") {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [authFetch, conversationKey]);

  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!authFetch || !conversationKey) return null;
    try {
      const res = await authFetch(`/api/messages/${conversationKey}/${messageId}/react`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const { reactions } = await res.json();
        setMessages((prev) => prev.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ));
        return reactions;
      }
    } catch {
      // ignore
    }
    return null;
  }, [authFetch, conversationKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, loading, sendMessage, deleteMessage, toggleReaction, clearMessages, refresh: fetchMessages };
}
