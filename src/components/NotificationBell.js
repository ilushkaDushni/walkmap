"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, X, Check, CheckCheck, Trophy, MessageCircle, UserPlus, UserCheck, Gift, Megaphone, Users, Coins } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import useUnreadCount from "@/hooks/useUnreadCount";
import { useRouter } from "next/navigation";
import AchievementModal from "./AchievementModal";

function timeAgo(date) {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} дн`;
  const months = Math.floor(days / 30);
  return `${months} мес`;
}

const ICON_MAP = {
  achievement: Trophy,
  comment_reply: MessageCircle,
  new_message: MessageCircle,
  friend_request: UserPlus,
  friend_accept: UserCheck,
  lobby_invite: Users,
  coin_gift: Gift,
  coin_admin: Coins,
  admin_broadcast: Megaphone,
};

const COLOR_MAP = {
  achievement: "text-amber-500",
  comment_reply: "text-blue-500",
  new_message: "text-blue-500",
  friend_request: "text-green-500",
  friend_accept: "text-green-500",
  lobby_invite: "text-purple-500",
  coin_gift: "text-yellow-500",
  coin_admin: "text-amber-500",
  admin_broadcast: "text-red-500",
};

function getNotificationText(n) {
  const d = n.data || {};
  switch (n.type) {
    case "achievement":
      return `Достижение "${d.title || d.slug}" получено!`;
    case "comment_reply":
      return `${d.username || "Кто-то"} ответил на ваш комментарий`;
    case "friend_request":
      return `${d.username || "Кто-то"} хочет добавить вас в друзья`;
    case "friend_accept":
      return `${d.username || "Кто-то"} принял вашу заявку в друзья`;
    case "lobby_invite":
      return `${d.username || "Кто-то"} приглашает в совместное прохождение`;
    case "coin_gift":
      return `${d.username || "Кто-то"} подарил вам ${d.amount || 0} монет`;
    case "coin_admin":
      return d.amount > 0
        ? `Администратор начислил вам ${d.amount} монет`
        : `Администратор списал ${Math.abs(d.amount)} монет`;
    case "new_message":
      return `${d.username || "Кто-то"} отправил вам сообщение`;
    case "admin_broadcast":
      return d.message || "Объявление от администрации";
    default:
      return "Новое уведомление";
  }
}

function getNotificationLink(n) {
  const d = n.data || {};
  switch (n.type) {
    case "comment_reply":
      return d.routeId ? `/routes/${d.routeId}` : null;
    case "new_message":
    case "friend_request":
    case "friend_accept":
      return "/friends";
    case "lobby_invite":
      return d.lobbyId ? `/routes/${d.routeId || ""}` : "/friends";
    case "coin_gift":
      return d.username ? `/users/${d.username}` : null;
    case "coin_admin":
      return null;
    default:
      return null;
  }
}

export default function NotificationBell({ inline = false }) {
  const { user, authFetch } = useUser();
  const { count, refresh } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [achievementSlug, setAchievementSlug] = useState(null);
  const [achievementDate, setAchievementDate] = useState(null);
  const [giftModalData, setGiftModalData] = useState(null);
  const [fromTop, setFromTop] = useState(false);
  const panelRef = useRef(null);
  const router = useRouter();

  const loadNotifications = useCallback(async (offset = 0) => {
    if (!authFetch) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/notifications?limit=20&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setNotifications(data.notifications || []);
        } else {
          setNotifications((prev) => [...prev, ...(data.notifications || [])]);
        }
        setTotal(data.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  // Переключение из чата (кнопка-звоночек в ChatView — колокольчик вверху)
  useEffect(() => {
    const handler = () => {
      setFromTop(true);
      setOpen((prev) => !prev);
    };
    window.addEventListener("toggle-notification-bell", handler);
    return () => window.removeEventListener("toggle-notification-bell", handler);
  }, []);

  // Закрытие при клике вне панели
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleFriendAction = async (e, notification, action) => {
    e.stopPropagation();
    if (actionInProgress) return;
    setActionInProgress(notification.id);
    try {
      const endpoint = action === "accept" ? "/api/friends/accept" : "/api/friends/reject";
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: notification.data?.userId }),
      });
      // Убираем уведомление в любом случае (ok или 404 — заявка уже обработана)
      await authFetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      refresh();
    } catch {
      // ignore
    } finally {
      setActionInProgress(null);
    }
  };

  const handleLobbyAction = async (e, notification, action) => {
    e.stopPropagation();
    if (actionInProgress) return;
    setActionInProgress(notification.id);
    try {
      if (action === "accept") {
        const res = await authFetch("/api/lobbies/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinCode: notification.data?.joinCode }),
        });
        if (res.ok) {
          const data = await res.json();
          window.dispatchEvent(new CustomEvent("lobby-joined", { detail: { lobbyId: data.id, routeId: notification.data?.routeId } }));
        }
      }
      await authFetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      refresh();
    } catch {
      // ignore
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReadAll = async () => {
    if (!authFetch) return;
    try {
      await authFetch("/api/notifications/read", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refresh();
    } catch {
      // ignore
    }
  };

  const handleClickNotification = async (n) => {
    // Прочитать конкретное уведомление
    if (!n.read && authFetch) {
      try {
        await authFetch("/api/notifications/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [n.id] }),
        });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
        );
        refresh();
      } catch {
        // ignore
      }
    }

    if (n.type === "achievement" && n.data?.slug) {
      setAchievementSlug(n.data.slug);
      setAchievementDate(n.createdAt);
      setOpen(false);
      return;
    }

    if (n.type === "coin_gift") {
      setGiftModalData({
        username: n.data?.username,
        avatarUrl: n.data?.avatarUrl,
        amount: n.data?.amount || 0,
        message: n.data?.message || "",
      });
      setOpen(false);
      return;
    }

    if (n.type === "coin_admin") {
      setGiftModalData({
        username: n.data?.adminUsername || "Администратор",
        amount: n.data?.amount || 0,
        message: n.data?.message || "",
        isAdmin: true,
      });
      setOpen(false);
      return;
    }

    if (n.type === "new_message" && n.data?.userId) {
      setOpen(false);
      router.push("/friends");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("open-chat", { detail: { friendId: n.data.userId } }));
      }, 100);
      return;
    }

    const link = getNotificationLink(n);
    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  if (!user) return null;

  const panelContent = (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden max-h-[60vh] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Уведомления</h3>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <button
              onClick={handleReadAll}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-green-500 transition"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Прочитать все
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Нет уведомлений</div>
        ) : (
          <div>
            {notifications.map((n) => {
              const Icon = ICON_MAP[n.type] || Bell;
              const colorCls = COLOR_MAP[n.type] || "text-[var(--text-secondary)]";
              const hasLink = !!getNotificationLink(n) || (n.type === "achievement" && n.data?.slug) || n.type === "coin_gift" || n.type === "coin_admin" || n.type === "new_message";
              return (
                <div
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--bg-elevated)] ${
                    !n.read ? "bg-[var(--bg-elevated)]/50" : ""
                  } ${hasLink ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className={`mt-0.5 shrink-0 ${colorCls}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.read ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"}`}>
                      {getNotificationText(n)}
                    </p>
                    {n.data?.message && (n.type === "coin_gift" || n.type === "coin_admin") && (
                      <p className="text-xs text-[var(--text-muted)] italic mt-0.5 truncate">&laquo;{n.data.message}&raquo;</p>
                    )}
                    {n.type === "new_message" && n.data?.text && (
                      <p className="text-xs text-[var(--text-muted)] italic mt-0.5 truncate">&laquo;{n.data.text}&raquo;</p>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{timeAgo(n.createdAt)}</span>
                    {n.type === "friend_request" && !n.read && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => handleFriendAction(e, n, "accept")}
                          disabled={actionInProgress === n.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 text-green-500 border border-green-500/30 hover:bg-green-500/25 transition disabled:opacity-50"
                        >
                          Принять
                        </button>
                        <button
                          onClick={(e) => handleFriendAction(e, n, "reject")}
                          disabled={actionInProgress === n.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                    {n.type === "lobby_invite" && !n.read && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => handleLobbyAction(e, n, "accept")}
                          disabled={actionInProgress === n.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-500 border border-purple-500/30 hover:bg-purple-500/25 transition disabled:opacity-50"
                        >
                          Присоединиться
                        </button>
                        <button
                          onClick={(e) => handleLobbyAction(e, n, "reject")}
                          disabled={actionInProgress === n.id}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                  {!n.read && n.type !== "friend_request" && n.type !== "lobby_invite" && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {notifications.length < total && (
          <button
            onClick={() => loadNotifications(notifications.length)}
            disabled={loading}
            className="w-full py-3 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition disabled:opacity-50"
          >
            {loading ? "Загрузка..." : "Показать ещё"}
          </button>
        )}
      </div>
    </div>
  );

  const achievementModal = achievementSlug ? (
    <AchievementModal
      slug={achievementSlug}
      date={achievementDate}
      onClose={() => { setAchievementSlug(null); setAchievementDate(null); }}
    />
  ) : null;

  const giftModal = giftModalData ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setGiftModalData(null)} />
      <div className="relative bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-2xl p-6 w-full max-w-xs text-center animate-scale-in">
        {!giftModalData.isAdmin && (
          <div className="flex justify-center mb-4">
            <UserAvatar
              username={giftModalData.username}
              avatarUrl={giftModalData.avatarUrl}
              size="lg"
            />
          </div>
        )}
        {giftModalData.isAdmin && (
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Coins className="h-8 w-8 text-amber-500" />
            </div>
          </div>
        )}
        <p className="text-lg font-bold text-[var(--text-primary)] mb-1">
          {giftModalData.isAdmin
            ? (giftModalData.amount > 0 ? "Начисление" : "Списание")
            : "Подарок!"}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          {giftModalData.isAdmin ? (
            <>
              {giftModalData.amount > 0 ? "Вам начислено " : "Списано "}
              <span className="font-bold text-yellow-500">{Math.abs(giftModalData.amount)} монет</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--text-primary)]">{giftModalData.username}</span>{" "}
              подарил вам{" "}
              <span className="font-bold text-yellow-500">{giftModalData.amount} монет</span>
            </>
          )}
        </p>
        {giftModalData.message && (
          <p className="text-sm text-[var(--text-primary)] italic bg-[var(--bg-elevated)] rounded-xl px-3 py-2 mb-4">
            &laquo;{giftModalData.message}&raquo;
          </p>
        )}
        {!giftModalData.message && <div className="mb-2" />}
        <button
          onClick={() => setGiftModalData(null)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/25 transition"
        >
          Ок
        </button>
      </div>
    </div>
  ) : null;

  // Inline-режим (в шапке на десктопе)
  if (inline) {
    return (
      <div className="relative">
        <button
          onClick={() => { setFromTop(false); setOpen(!open); }}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--bg-elevated)] transition"
        >
          <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-[58] bg-black/20" onClick={() => setOpen(false)} />
            <div ref={panelRef} className="absolute top-full right-0 mt-2 z-[59] w-[min(calc(100vw-2rem),384px)] animate-slide-down">
              {panelContent}
            </div>
          </>
        )}
        {achievementModal}
        {giftModal}
      </div>
    );
  }

  // Мобильный режим (плавающая кнопка)
  return (
    <>
      <button
        onClick={() => { setFromTop(false); setOpen(!open); }}
        className="fixed bottom-24 right-4 z-[55] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[58] bg-black/20" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            className={`fixed right-4 z-[59] w-[calc(100%-2rem)] max-w-sm ${
              fromTop ? "top-14 animate-slide-down" : "bottom-40 animate-slide-up"
            }`}
          >
            {panelContent}
          </div>
        </>
      )}
      {achievementModal}
      {giftModal}
    </>
  );
}
