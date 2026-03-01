"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, X, Gift, Coins, LifeBuoy, Shield, UserPlus, UserCheck, MessageSquare, Users, Trophy, Package, Ban } from "lucide-react";
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
    if (data.type === "typing") {
      window.dispatchEvent(new CustomEvent("chat-typing", {
        detail: { conversationKey: data.conversationKey, userId: data.userId },
      }));
      return;
    }
    if (data.type === "new_message") {
      const ck = data.conversationKey;
      if (ck) {
        window.dispatchEvent(new CustomEvent("new-chat-message", { detail: { conversationKey: ck } }));
      }
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
      if (ck) {
        window.dispatchEvent(new CustomEvent("new-chat-message", { detail: { conversationKey: ck } }));
      }
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
    } else if (data.type === "friend_request") {
      setToast({
        id: Date.now().toString(),
        toastType: "friend_request",
        username: data.username || "Кто-то",
        avatarUrl: data.avatarUrl || null,
        text: "хочет добавить вас в друзья",
      });
    } else if (data.type === "friend_accept") {
      setToast({
        id: Date.now().toString(),
        toastType: "friend_accept",
        username: data.username || "Кто-то",
        avatarUrl: data.avatarUrl || null,
        text: "принял вашу заявку в друзья",
      });
    } else if (data.type === "comment_reply") {
      setToast({
        id: Date.now().toString(),
        toastType: "comment_reply",
        username: data.username || "Кто-то",
        text: "ответил на ваш комментарий",
        routeId: data.routeId,
      });
    } else if (data.type === "lobby_invite") {
      setToast({
        id: Date.now().toString(),
        toastType: "lobby_invite",
        username: data.username || "Кто-то",
        avatarUrl: data.avatarUrl || null,
        text: `приглашает в лобби: ${data.routeTitle || "маршрут"}`,
        joinCode: data.joinCode,
      });
    } else if (data.type === "item_gift") {
      setToast({
        id: Date.now().toString(),
        toastType: "item_gift",
        username: data.adminUsername || "Администратор",
        text: `Вам подарен предмет: ${data.itemName || ""}`,
        message: data.message || "",
      });
    } else if (data.type === "item_revoke") {
      setToast({
        id: Date.now().toString(),
        toastType: "item_revoke",
        username: data.adminUsername || "Администратор",
        text: `Предмет изъят: ${data.itemName || ""}`,
        message: data.reason || "",
      });
    } else if (data.type === "account_banned") {
      setToast({
        id: Date.now().toString(),
        toastType: "account_banned",
        username: data.adminUsername || "Администратор",
        text: data.duration ? `Вы забанены на ${data.duration} дн.` : "Вы забанены",
        message: data.reason || "",
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

        const TOAST_TYPES = ["new_message", "coin_gift", "coin_admin", "admin_message", "ticket_reply", "friend_request", "friend_accept", "comment_reply", "lobby_invite", "item_gift", "item_revoke", "account_banned"];
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
          } else if (n.type === "friend_request") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "friend_request",
              username: n.data?.username || "Кто-то", avatarUrl: n.data?.avatarUrl || null,
              text: "хочет добавить вас в друзья",
            });
          } else if (n.type === "friend_accept") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "friend_accept",
              username: n.data?.username || "Кто-то", avatarUrl: n.data?.avatarUrl || null,
              text: "принял вашу заявку в друзья",
            });
          } else if (n.type === "comment_reply") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "comment_reply",
              username: n.data?.username || "Кто-то",
              text: "ответил на ваш комментарий",
              routeId: n.data?.routeId,
            });
          } else if (n.type === "lobby_invite") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "lobby_invite",
              username: n.data?.username || "Кто-то", avatarUrl: n.data?.avatarUrl || null,
              text: `приглашает в лобби: ${n.data?.routeTitle || "маршрут"}`,
              joinCode: n.data?.joinCode,
            });
          } else if (n.type === "item_gift") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "item_gift",
              username: n.data?.adminUsername || "Администратор",
              text: `Вам подарен предмет: ${n.data?.itemName || ""}`,
              message: n.data?.message || "",
            });
          } else if (n.type === "item_revoke") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "item_revoke",
              username: n.data?.adminUsername || "Администратор",
              text: `Предмет изъят: ${n.data?.itemName || ""}`,
              message: n.data?.reason || "",
            });
          } else if (n.type === "account_banned") {
            shownIdsRef.current.add(n.id);
            setToast({
              id: n.id, toastType: "account_banned",
              username: n.data?.adminUsername || "Администратор",
              text: n.data?.duration ? `Вы забанены на ${n.data.duration} дн.` : "Вы забанены",
              message: n.data?.reason || "",
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
    if (toast.toastType === "coin_gift" || toast.toastType === "coin_admin" || toast.toastType === "item_gift" || toast.toastType === "item_revoke" || toast.toastType === "account_banned") {
      return;
    }
    if (toast.toastType === "comment_reply" && toast.routeId) {
      router.push(`/routes/${toast.routeId}`);
      return;
    }
    if (toast.toastType === "friend_request" || toast.toastType === "friend_accept") {
      router.push("/friends");
      return;
    }
    if (toast.toastType === "lobby_invite") {
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
    : toast.toastType === "friend_request" ? <UserPlus className="h-4 w-4 text-blue-500 shrink-0" />
    : toast.toastType === "friend_accept" ? <UserCheck className="h-4 w-4 text-green-500 shrink-0" />
    : toast.toastType === "comment_reply" ? <MessageSquare className="h-4 w-4 text-purple-500 shrink-0" />
    : toast.toastType === "lobby_invite" ? <Users className="h-4 w-4 text-indigo-500 shrink-0" />
    : toast.toastType === "item_gift" ? <Package className="h-4 w-4 text-emerald-500 shrink-0" />
    : toast.toastType === "item_revoke" ? <Package className="h-4 w-4 text-red-500 shrink-0" />
    : toast.toastType === "account_banned" ? <Ban className="h-4 w-4 text-red-500 shrink-0" />
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
        ) : toast.toastType === "item_gift" ? (
          <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-emerald-500" />
          </div>
        ) : toast.toastType === "item_revoke" || toast.toastType === "account_banned" ? (
          <div className="h-8 w-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            {toast.toastType === "account_banned" ? <Ban className="h-4 w-4 text-red-500" /> : <Package className="h-4 w-4 text-red-500" />}
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
