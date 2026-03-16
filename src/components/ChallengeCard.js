"use client";

import { useState } from "react";
import { Swords, Check, X, Coins, Clock } from "lucide-react";
import { useUser } from "./UserProvider";

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Карточка челленджа в чате.
 * Props: challengeData — из msg.challengeData, isMe — отправитель ли я
 */
export default function ChallengeCard({ challengeData, isMe }) {
  const { user, authFetch } = useUser();
  const [status, setStatus] = useState(challengeData.status);
  const [loading, setLoading] = useState(false);

  const isChallenged = !isMe; // карточку видит challenged
  const isPending = status === "pending";

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/challenges/${challengeData.challengeId}/accept`, {
        method: "POST",
      });
      if (res.ok) setStatus("accepted");
      else {
        const data = await res.json();
        alert(data.error || "Ошибка");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/challenges/${challengeData.challengeId}/decline`, {
        method: "POST",
      });
      if (res.ok) setStatus("declined");
      else {
        const data = await res.json();
        alert(data.error || "Ошибка");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Swords className="h-4 w-4 text-orange-500" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {challengeData.routeTitle}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        {challengeData.stakeCoins > 0 && (
          <span className="flex items-center gap-1">
            <Coins className="h-3 w-3 text-yellow-500" />
            Ставка: {challengeData.stakeCoins}
          </span>
        )}
        {challengeData.challengerTime && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(challengeData.challengerTime)}
          </span>
        )}
      </div>

      {/* Статус */}
      {status === "accepted" && (
        <p className="text-xs font-medium text-green-500">Вызов принят! Пройдите маршрут</p>
      )}
      {status === "declined" && (
        <p className="text-xs font-medium text-red-400">Вызов отклонён</p>
      )}
      {status === "completed" && (
        <p className="text-xs font-medium text-purple-500">Дуэль завершена</p>
      )}
      {status === "expired" && (
        <p className="text-xs font-medium text-[var(--text-muted)]">Вызов истёк</p>
      )}

      {/* Кнопки (только для challenged, только pending) */}
      {isChallenged && isPending && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-green-500 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Принять
          </button>
          <button
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-400/30 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-400/10 transition disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            Отклонить
          </button>
        </div>
      )}
    </div>
  );
}
