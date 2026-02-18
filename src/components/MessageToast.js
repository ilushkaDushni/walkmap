"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import { useRouter } from "next/navigation";
import useNotificationSSE from "@/hooks/useNotificationSSE";

export default function MessageToast() {
  const { user, authFetch } = useUser();
  const router = useRouter();
  const [toast, setToast] = useState(null);
  const activeChatsRef = useRef(new Set());
  const shownIdsRef = useRef(new Set());
  const timerRef = useRef(null);

  // Слушаем события chat-active / chat-closed
  useEffect(() => {
    const onActive = (e) => {
      activeChatsRef.current.add(e.detail?.conversationKey);
    };
    const onClosed = (e) => {
      activeChatsRef.current.delete(e.detail?.conversationKey);
    };
    window.addEventListener("chat-active", onActive);
    window.addEventListener("chat-closed", onClosed);
    return () => {
      window.removeEventListener("chat-active", onActive);
      window.removeEventListener("chat-closed", onClosed);
    };
  }, []);

  // SSE — мгновенный тост
  useNotificationSSE(useCallback((data) => {
    if (data.type !== "new_message") return;

    // Не показывать если чат с этим другом уже открыт
    const ck = data.conversationKey;
    if (ck && activeChatsRef.current.has(ck)) return;

    setToast({
      id: Date.now().toString(),
      username: data.username || "Кто-то",
      avatarUrl: data.avatarUrl || null,
      text: data.text || "",
      friendId: data.userId,
    });

    // Триггерим обновление бейджа непрочитанных
    window.dispatchEvent(new Event("refresh-unread"));
  }, []));

  // Fallback полинг (60с)
  useEffect(() => {
    if (!user || !authFetch) return;

    const poll = async () => {
      try {
        const res = await authFetch("/api/notifications?limit=5");
        if (!res.ok) return;
        const data = await res.json();
        const notifications = data.notifications || [];

        for (const n of notifications) {
          if (n.type !== "new_message" || n.read) continue;
          if (shownIdsRef.current.has(n.id)) continue;

          const ck = n.data?.conversationKey;
          if (ck && activeChatsRef.current.has(ck)) continue;

          shownIdsRef.current.add(n.id);
          setToast({
            id: n.id,
            username: n.data?.username || "Кто-то",
            avatarUrl: n.data?.avatarUrl || null,
            text: n.data?.text || "",
            friendId: n.data?.userId,
          });
          break;
        }
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 60_000);

    // При возврате на вкладку — poll сразу
    const onVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, authFetch]);

  // Авто-скрытие через 5с
  useEffect(() => {
    if (!toast) return;
    timerRef.current = setTimeout(() => setToast(null), 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  const handleClick = useCallback(() => {
    if (!toast) return;
    setToast(null);
    router.push("/friends");
    if (toast.friendId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-chat", { detail: { friendId: toast.friendId } }));
      }, 100);
    }
  }, [toast, router]);

  if (!toast) return null;

  return (
    <div
      onClick={handleClick}
      className="fixed top-16 left-4 right-4 z-[90] mx-auto max-w-sm cursor-pointer animate-slide-down"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl px-4 py-3">
        <UserAvatar username={toast.username} avatarUrl={toast.avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{toast.username}</p>
          {toast.text && (
            <p className="text-xs text-[var(--text-muted)] truncate">{toast.text}</p>
          )}
        </div>
        <MessageCircle className="h-4 w-4 text-blue-500 shrink-0" />
        <button
          onClick={(e) => { e.stopPropagation(); setToast(null); }}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
