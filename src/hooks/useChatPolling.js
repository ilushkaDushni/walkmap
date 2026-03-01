"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";

let tempIdCounter = 0;

export default function useChatPolling(conversationKey, { interval = 5000, enabled = true, adminMode = false } = {}) {
  const { authFetch } = useUser();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const intervalRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const initialLoadDone = useRef(false);
  const typingTimerRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  // Начальная загрузка
  const fetchInitial = useCallback(async () => {
    if (!authFetch || !conversationKey) return;
    try {
      const res = await authFetch(`/api/messages/${conversationKey}?limit=50`);
      if (res.ok) {
        const data = await res.json();
        const msgs = data.messages || [];
        setMessages(msgs);
        setHasMore(!!data.hasMore);
        setTypingUsers(data.typingUsers || []);
        if (msgs.length > 0) {
          lastTimestampRef.current = msgs[msgs.length - 1].createdAt;
        }
        initialLoadDone.current = true;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch, conversationKey]);

  // Инкрементальный fetch — только новые сообщения
  const fetchIncremental = useCallback(async () => {
    if (!authFetch || !conversationKey || !initialLoadDone.current) return;
    try {
      const afterParam = lastTimestampRef.current
        ? `&after=${encodeURIComponent(lastTimestampRef.current)}`
        : "";
      const res = await authFetch(`/api/messages/${conversationKey}?limit=50${afterParam}`);
      if (res.ok) {
        const data = await res.json();
        const newMsgs = data.messages || [];
        setTypingUsers(data.typingUsers || []);

        if (newMsgs.length > 0) {
          lastTimestampRef.current = newMsgs[newMsgs.length - 1].createdAt;
          setMessages((prev) => {
            // Убираем optimistic-дубли и мерджим
            const existingIds = new Set(prev.filter((m) => !m._optimistic).map((m) => m.id));
            const realNew = newMsgs.filter((m) => !existingIds.has(m.id));
            // Заменяем optimistic на серверные
            const withoutOptimistic = prev.filter((m) => {
              if (!m._optimistic) return true;
              return !newMsgs.some((n) => n.text === m.text && n.senderId === m.senderId);
            });
            return [...withoutOptimistic, ...realNew];
          });
        }
      }
    } catch {
      // ignore
    }
  }, [authFetch, conversationKey]);

  // Загрузка старых сообщений
  const loadOlder = useCallback(async () => {
    if (!authFetch || !conversationKey || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const firstMsg = messages[0];
      if (!firstMsg) return;
      const res = await authFetch(
        `/api/messages/${conversationKey}?limit=30&before=${encodeURIComponent(firstMsg.createdAt)}`
      );
      if (res.ok) {
        const data = await res.json();
        const olderMsgs = data.messages || [];
        setHasMore(!!data.hasMore);
        if (olderMsgs.length > 0) {
          setMessages((prev) => [...olderMsgs, ...prev]);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingOlder(false);
    }
  }, [authFetch, conversationKey, loadingOlder, hasMore, messages]);

  const markRead = useCallback(async () => {
    if (!authFetch || !conversationKey) return;
    try {
      await authFetch(`/api/messages/${conversationKey}/read`, { method: "PATCH" });
      // Обновляем бейджи непрочитанных после прочтения
      window.dispatchEvent(new Event("refresh-unread"));
    } catch {
      // ignore
    }
  }, [authFetch, conversationKey]);

  // Polling
  useEffect(() => {
    if (!enabled || !conversationKey) return;

    fetchInitial().then(() => markRead());

    intervalRef.current = setInterval(() => {
      fetchIncremental().then(() => markRead());
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      initialLoadDone.current = false;
      lastTimestampRef.current = null;
    };
  }, [enabled, conversationKey, interval, fetchInitial, fetchIncremental, markRead]);

  // SSE → мгновенный fetch новых сообщений
  useEffect(() => {
    if (!enabled || !conversationKey) return;
    const handler = (e) => {
      if (e.detail?.conversationKey === conversationKey) {
        fetchIncremental().then(() => markRead());
      }
    };
    window.addEventListener("new-chat-message", handler);
    return () => window.removeEventListener("new-chat-message", handler);
  }, [enabled, conversationKey, fetchIncremental, markRead]);

  // SSE → read receipts (собеседник прочитал наши сообщения → ✓✓)
  useEffect(() => {
    if (!enabled || !conversationKey) return;
    const handler = (e) => {
      if (e.detail?.conversationKey === conversationKey) {
        const now = new Date().toISOString();
        setMessages((prev) =>
          prev.map((m) => {
            if (m.readAt || m._status === "sending" || m._status === "error") return m;
            return { ...m, readAt: now };
          })
        );
      }
    };
    window.addEventListener("chat-messages-read", handler);
    return () => window.removeEventListener("chat-messages-read", handler);
  }, [enabled, conversationKey]);

  // SSE → typing indicator (per-user timeout tracking)
  const typingTimeoutsRef = useRef(new Map());
  useEffect(() => {
    if (!enabled || !conversationKey) return;
    const handler = (e) => {
      if (e.detail?.conversationKey === conversationKey) {
        const typingUserId = e.detail.userId;
        setTypingUsers((prev) => {
          if (prev.includes(typingUserId)) return prev;
          return [...prev, typingUserId];
        });
        // Сбрасываем старый таймаут для этого юзера
        const oldTimer = typingTimeoutsRef.current.get(typingUserId);
        if (oldTimer) clearTimeout(oldTimer);
        const timer = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((id) => id !== typingUserId));
          typingTimeoutsRef.current.delete(typingUserId);
        }, 4000);
        typingTimeoutsRef.current.set(typingUserId, timer);
      }
    };
    window.addEventListener("chat-typing", handler);
    return () => {
      window.removeEventListener("chat-typing", handler);
      // Чистим все таймауты при unmount
      for (const t of typingTimeoutsRef.current.values()) clearTimeout(t);
      typingTimeoutsRef.current.clear();
    };
  }, [enabled, conversationKey]);

  // Optimistic send
  const sendMessage = useCallback(async (text, routeId = null, replyToId = null) => {
    if (!authFetch || !conversationKey) return null;

    const tempId = `_temp_${++tempIdCounter}`;
    const optimisticMsg = {
      id: tempId,
      senderId: "__me__",
      text,
      type: "text",
      imageUrl: null,
      routeId,
      replyToId,
      replyTo: null,
      reactions: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      readAt: null,
      _optimistic: true,
      _status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await authFetch(`/api/messages/${conversationKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, routeId, replyToId, adminMode: adminMode || undefined }),
      });
      if (res.ok) {
        const msg = await res.json();
        lastTimestampRef.current = msg.createdAt;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...msg, _optimistic: false } : m))
        );
        return msg;
      } else {
        // Ошибка — помечаем
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m))
      );
    }
    return null;
  }, [authFetch, conversationKey, adminMode]);

  // Retry failed message
  const retryMessage = useCallback(async (tempId) => {
    const msg = messages.find((m) => m.id === tempId);
    if (!msg || !msg._optimistic) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, _status: "sending" } : m))
    );

    try {
      const res = await authFetch(`/api/messages/${conversationKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.text, routeId: msg.routeId, replyToId: msg.replyToId, adminMode: adminMode || undefined }),
      });
      if (res.ok) {
        const serverMsg = await res.json();
        lastTimestampRef.current = serverMsg.createdAt;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...serverMsg, _optimistic: false } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m))
      );
    }
  }, [authFetch, conversationKey, messages]);

  // Send image
  const sendImage = useCallback(async (file) => {
    if (!authFetch || !conversationKey) return null;

    const tempId = `_temp_${++tempIdCounter}`;
    const previewUrl = URL.createObjectURL(file);
    const optimisticMsg = {
      id: tempId,
      senderId: "__me__",
      text: null,
      type: "image",
      imageUrl: previewUrl,
      routeId: null,
      replyToId: null,
      replyTo: null,
      reactions: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      readAt: null,
      _optimistic: true,
      _status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch(`/api/messages/${conversationKey}/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const msg = await res.json();
        lastTimestampRef.current = msg.createdAt;
        URL.revokeObjectURL(previewUrl);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...msg, _optimistic: false } : m))
        );
        return msg;
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _status: "error" } : m))
      );
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
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
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

  // Edit message
  const editMessage = useCallback(async (messageId, newText) => {
    if (!authFetch || !conversationKey) return false;
    try {
      const res = await authFetch(`/api/messages/${conversationKey}/${messageId}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText }),
      });
      if (res.ok) {
        const { text, editedAt } = await res.json();
        setMessages((prev) => prev.map((m) =>
          m.id === messageId ? { ...m, text, editedAt } : m
        ));
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [authFetch, conversationKey]);

  // Typing indicator
  const sendTyping = useCallback(async () => {
    if (!authFetch || !conversationKey) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;
    try {
      await authFetch(`/api/messages/${conversationKey}/typing`, { method: "POST" });
    } catch {
      // ignore
    }
  }, [authFetch, conversationKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    lastTimestampRef.current = null;
    initialLoadDone.current = false;
  }, []);

  return {
    messages,
    loading,
    hasMore,
    loadingOlder,
    typingUsers,
    sendMessage,
    sendImage,
    retryMessage,
    deleteMessage,
    toggleReaction,
    editMessage,
    loadOlder,
    sendTyping,
    clearMessages,
    refresh: fetchInitial,
  };
}
