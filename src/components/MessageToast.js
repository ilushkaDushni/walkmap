"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, X, Gift, Coins, LifeBuoy, Shield } from "lucide-react";
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
    if (data.type === "new_message") {
      const ck = data.conversationKey;
      if (ck && activeChatsRef.current.has(ck)) return;
      setToast({
        id: Date.now().toString(),
        toastType: "message",
        username: data.username || "Кто-то",
        avatarUrl: data.avatarUrl || null,
        text: data.text || "",
        friendId: data.userId,
      });
    } else if (data.type === "coin_gift") {
      setToast({
        id: Date.now().toString(),
        toastType: "coin_gift",
        username: data.username || "Кто-то",
        avatarUrl: data.avatarUrl || null,
        text: `подарил вам ${data.amount || 0} монет`,
        amount: data.amount || 0,
        message: data.message || "",
      });
    } else if (data.type === "coin_admin") {
      const amt = data.amount || 0;
      setToast({
        id: Date.now().toString(),
        toastType: "coin_admin",
        username: "Администратор",
        text: amt > 0 ? `Начислено ${amt} монет` : `Списано ${Math.abs(amt)} монет`,
        amount: amt,
        message: data.message || "",
      });
    } else if (data.type === "admin_message") {
      const ck = data.conversationKey;
      if (ck && activeChatsRef.current.has(ck)) return;
      setToast({
        id: Date.now().toString(),
        toastType: "admin_message",
        username: data.adminUsername || "Администрация",
        text: data.text || "",
      });
    } else if (data.type === "ticket_reply") {
      setToast({
        id: Date.now().toString(),
        toastType: "ticket_reply",
        username: data.adminUsername || "Поддержка",
        text: "ответила на ваше обращение",
        ticketId: data.ticketId,
      });
    } else {
      return;
    }

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

        const TOAST_TYPES = ["new_message", "coin_gift", "coin_admin", "admin_message", "ticket_reply"];
        for (const n of notifications) {
          if (!TOAST_TYPES.includes(n.type) || n.read) continue;
          if (shownIdsRef.current.has(n.id)) continue;

          if (n.type === "admin_message") {
            const ck = n.data?.conversationKey;
            if (ck && activeChatsRef.current.has(ck)) continue;
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "admin_message",
              username: n.data?.adminUsername || "Администрация",
              text: n.data?.text || "",
            });
          } else if (n.type === "new_message") {
            const ck = n.data?.conversationKey;
            if (ck && activeChatsRef.current.has(ck)) continue;
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "message",
              username: n.data?.username || "Кто-то", avatarUrl: n.data?.avatarUrl || null,
              text: n.data?.text || "", friendId: n.data?.userId,
            });
          } else if (n.type === "coin_gift") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "coin_gift",
              username: n.data?.username || "Кто-то", avatarUrl: n.data?.avatarUrl || null,
              text: `подарил вам ${n.data?.amount || 0} монет`,
              amount: n.data?.amount || 0, message: n.data?.message || "",
            });
          } else if (n.type === "coin_admin") {
            const amt = n.data?.amount || 0;
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "coin_admin", username: "Администратор",
              text: amt > 0 ? `Начислено ${amt} монет` : `Списано ${Math.abs(amt)} монет`,
              amount: amt, message: n.data?.message || "",
            });
          } else if (n.type === "ticket_reply") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "ticket_reply",
              username: n.data?.adminUsername || "Поддержка",
              text: "ответила на ваше обращение",
              ticketId: n.data?.ticketId,
            });
          }
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
    if (toast.toastType === "ticket_reply" && toast.ticketId) {
      window.dispatchEvent(new CustomEvent("open-support-screen", { detail: { ticketId: toast.ticketId } }));
      return;
    }
    if (toast.toastType === "coin_gift" || toast.toastType === "coin_admin") {
      return;
    }
    if (toast.toastType === "admin_message") {
      router.push("/friends");
      setTimeout(() => {
        window.dispatchEvent(new Event("open-admin-chat"));
      }, 100);
      return;
    }
    router.push("/friends");
    if (toast.friendId) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-chat", { detail: { friendId: toast.friendId } }));
      }, 100);
    }
  }, [toast, router]);

  if (!toast) return null;

  const toastIcon = toast.toastType === "coin_gift" ? <Gift className="h-4 w-4 text-yellow-500 shrink-0" />
    : toast.toastType === "coin_admin" ? <Coins className="h-4 w-4 text-amber-500 shrink-0" />
    : toast.toastType === "ticket_reply" ? <LifeBuoy className="h-4 w-4 text-teal-500 shrink-0" />
    : toast.toastType === "admin_message" ? <Shield className="h-4 w-4 text-red-500 shrink-0" />
    : <MessageCircle className="h-4 w-4 text-blue-500 shrink-0" />;

  return (
    <div
      onClick={handleClick}
      className="fixed top-16 left-4 right-4 z-[90] mx-auto max-w-sm cursor-pointer animate-slide-down"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl px-4 py-3">
        {toast.avatarUrl ? (
          <UserAvatar username={toast.username} avatarUrl={toast.avatarUrl} size="sm" />
        ) : toast.toastType === "coin_admin" ? (
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
            <Coins className="h-4 w-4 text-amber-500" />
          </div>
        ) : toast.toastType === "ticket_reply" ? (
          <div className="h-8 w-8 rounded-full bg-teal-500/15 flex items-center justify-center shrink-0">
            <LifeBuoy className="h-4 w-4 text-teal-500" />
          </div>
        ) : toast.toastType === "admin_message" ? (
          <div className="h-8 w-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-red-500" />
          </div>
        ) : (
          <UserAvatar username={toast.username} size="sm" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{toast.username}</p>
          {toast.text && (
            <p className="text-xs text-[var(--text-muted)] truncate">{toast.text}</p>
          )}
          {toast.message && (
            <p className="text-[10px] text-[var(--text-muted)] italic truncate">&laquo;{toast.message}&raquo;</p>
          )}
        </div>
        {toastIcon}
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
