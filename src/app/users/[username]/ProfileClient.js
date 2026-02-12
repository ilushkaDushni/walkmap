"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Footprints, Ruler, Coins, Trophy, Shield, Map, Compass,
  Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
  UserPlus, UserCheck, Clock, Gift, Trash2, X,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { useUser } from "@/components/UserProvider";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES } from "@/lib/achievements";

const ICON_MAP = {
  Footprints, Coins, Compass, Ruler, Map, Trophy,
  Shield, Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
};

function formatDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} км`;
  return `${m} м`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", { year: "numeric", month: "long" });
}

const LEVELS = [
  { min: 0, title: "Начинающий", color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-elevated)]" },
  { min: 1, title: "Новичок", color: "text-green-500", bg: "bg-green-500/10" },
  { min: 5, title: "Путешественник", color: "text-blue-500", bg: "bg-blue-500/10" },
  { min: 10, title: "Исследователь", color: "text-purple-500", bg: "bg-purple-500/10" },
  { min: 20, title: "Легенда", color: "text-yellow-500", bg: "bg-yellow-500/10" },
];

function getUserLevel(c) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (c >= l.min) lvl = l; }
  return lvl;
}

export default function ProfileClient({ profile }) {
  const { id: profileId, username, avatarUrl, bio, createdAt, roles, stats, achievements } = profile;
  const { user, authFetch } = useUser();
  const router = useRouter();
  const primaryRoleColor = roles?.[0]?.color || null;
  const achievementSet = new Set(achievements);
  const level = getUserLevel(stats.completedRoutes);

  const isOwnProfile = user?.id === profileId;
  const [friendStatus, setFriendStatus] = useState(null); // "none" | "friend" | "pending_sent" | "pending_received"
  const [actionLoading, setActionLoading] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState("");
  const [giftError, setGiftError] = useState("");
  const [giftSending, setGiftSending] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const fetchFriendStatus = useCallback(async () => {
    if (!authFetch || !user || isOwnProfile) return;
    try {
      const res = await authFetch(`/api/friends/search?q=${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        const match = (data.users || []).find((u) => u.id === profileId);
        setFriendStatus(match?.friendStatus || "none");
      }
    } catch { /* ignore */ }
  }, [authFetch, user, isOwnProfile, username, profileId]);

  useEffect(() => { fetchFriendStatus(); }, [fetchFriendStatus]);

  const handleAddFriend = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: profileId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFriendStatus(data.status === "accepted" ? "friend" : "pending_sent");
      }
    } catch { /* ignore */ }
    finally { setActionLoading(false); }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: profileId }),
      });
      if (res.ok) setFriendStatus("friend");
    } catch { /* ignore */ }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch("/api/friends/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: profileId }),
      });
      if (res.ok) setFriendStatus("none");
    } catch { /* ignore */ }
    finally { setActionLoading(false); }
  };

  const handleRemove = async () => {
    try {
      const res = await authFetch(`/api/friends/${profileId}`, { method: "DELETE" });
      if (res.ok) setFriendStatus("none");
    } catch { /* ignore */ }
    finally { setRemoveOpen(false); }
  };

  const handleGift = async () => {
    const parsed = parseInt(giftAmount, 10);
    if (!parsed || parsed < 1 || parsed > 100) {
      setGiftError("Введите сумму от 1 до 100");
      return;
    }
    setGiftError("");
    setGiftSending(true);
    try {
      const res = await authFetch("/api/friends/gift-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: profileId, amount: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setGiftOpen(false);
    } catch (e) {
      setGiftError(e.message);
    } finally {
      setGiftSending(false);
    }
  };

  const renderFriendActions = () => {
    if (!user || isOwnProfile || friendStatus === null) return null;

    if (friendStatus === "none") {
      return (
        <button
          onClick={handleAddFriend}
          disabled={actionLoading}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--bg-surface)] hover:opacity-90 transition disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          Добавить в друзья
        </button>
      );
    }

    if (friendStatus === "pending_sent") {
      return (
        <span className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-[var(--bg-elevated)] px-5 py-2.5 text-sm font-medium text-[var(--text-muted)]">
          <Clock className="h-4 w-4" />
          Заявка отправлена
        </span>
      );
    }

    if (friendStatus === "pending_received") {
      return (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleAccept}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-green-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-600 transition disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            Принять
          </button>
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Отклонить
          </button>
        </div>
      );
    }

    // friend
    return (
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => router.push("/friends")}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-500 border border-blue-500/30 hover:bg-blue-500/20 transition"
        >
          <MessageCircle className="h-4 w-4" />
          Чат
        </button>
        <button
          onClick={() => { setGiftOpen(true); setGiftAmount(""); setGiftError(""); }}
          className="inline-flex items-center gap-2 rounded-2xl bg-yellow-500/10 px-4 py-2.5 text-sm font-semibold text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/20 transition"
        >
          <Gift className="h-4 w-4" />
          Подарить
        </button>
        <button
          onClick={() => setRemoveOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/20 transition"
        >
          <Trash2 className="h-4 w-4" />
          Удалить
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-24">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад
      </Link>

      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <UserAvatar username={username} avatarUrl={avatarUrl} roleColor={primaryRoleColor} size="xl" />
        <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{username}</h1>
        <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${level.bg} ${level.color}`}>
          <Trophy className="h-3 w-3" />
          {level.title}
        </span>
        {bio && (
          <p className="mt-1 text-sm text-[var(--text-secondary)] text-center max-w-[300px]">{bio}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
          {roles.map((role) => (
            <span
              key={role.id || role.slug}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${role.color}20`, color: role.color }}
            >
              <Shield className="h-3 w-3" />
              {role.name}
            </span>
          ))}
        </div>
        {createdAt && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            С нами с {formatDate(createdAt)}
          </p>
        )}
        {renderFriendActions()}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-sky-500/5 border border-[var(--border-color)] py-4 px-2">
          <Footprints className="mb-1 h-6 w-6 text-blue-500" />
          <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
            {stats.completedRoutes}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] text-center">Пройдено</div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-green-500/5 border border-[var(--border-color)] py-4 px-2">
          <Ruler className="mb-1 h-6 w-6 text-emerald-500" />
          <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
            {formatDist(stats.totalDistanceM)}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] text-center">Дистанция</div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500/15 to-amber-500/5 border border-[var(--border-color)] py-4 px-2">
          <Coins className="mb-1 h-6 w-6 text-yellow-500" />
          <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
            {stats.coins}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] text-center">Монеты</div>
        </div>
      </div>

      {/* Achievements */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Достижения</h2>
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {achievementSet.size}<span className="text-[var(--text-muted)]">/{ACHIEVEMENT_REGISTRY.length}</span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENT_REGISTRY.map((a) => {
            const Icon = ICON_MAP[a.icon] || Trophy;
            const colors = COLOR_CLASSES[a.color] || COLOR_CLASSES.blue;
            const ok = achievementSet.has(a.slug);
            const prog = a.progress(stats);
            return (
              <div
                key={a.slug}
                className={`flex flex-col items-center rounded-xl py-2.5 px-1 transition ${ok ? colors.bg : "bg-[var(--bg-elevated)] opacity-50"}`}
                title={`${a.title}: ${a.desc}`}
              >
                <Icon className={`h-5 w-5 ${ok ? colors.text : "text-[var(--text-muted)]"}`} />
                <span className={`text-[9px] font-medium mt-1 text-center leading-tight ${ok ? colors.text : "text-[var(--text-muted)]"}`}>{a.title}</span>
                <span className={`text-[8px] mt-0.5 ${ok ? colors.text : "text-[var(--text-muted)]"}`}>
                  {prog.current}/{prog.target}{prog.unit ? ` ${prog.unit}` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gift modal */}
      {giftOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setGiftOpen(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl animate-slide-up">
              <h3 className="text-lg font-bold text-[var(--text-primary)] text-center mb-1">
                Подарить монеты
              </h3>
              <p className="text-sm text-[var(--text-muted)] text-center mb-4">{username}</p>
              <input
                type="number"
                min={1}
                max={100}
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGift()}
                placeholder="Количество (1-100)"
                className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] text-center placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)]"
                autoFocus
              />
              {giftError && <p className="text-center text-xs text-red-400 mt-2">{giftError}</p>}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setGiftOpen(false)}
                  className="flex-1 rounded-2xl border border-[var(--border-color)] py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleGift}
                  disabled={giftSending || !giftAmount}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-yellow-500 py-3 text-sm font-semibold text-white hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  <Gift className="h-4 w-4" />
                  {giftSending ? "Отправка..." : "Подарить"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Remove confirmation */}
      {removeOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={() => setRemoveOpen(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl animate-slide-up">
              <h3 className="text-lg font-bold text-[var(--text-primary)] text-center mb-1">
                Удалить из друзей
              </h3>
              <p className="text-sm text-[var(--text-muted)] text-center mb-4">
                Вы уверены, что хотите удалить <span className="font-semibold text-[var(--text-primary)]">{username}</span> из друзей?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setRemoveOpen(false)}
                  className="flex-1 rounded-2xl border border-[var(--border-color)] py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleRemove}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 transition"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
