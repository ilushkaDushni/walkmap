"use client";

import { useState, useEffect } from "react";
import { Swords, Clock, Coins, Trophy, ChevronRight } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import ChallengeResultModal from "./ChallengeResultModal";

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

const STATUS_LABELS = {
  pending: { label: "Ожидает", color: "text-yellow-500" },
  accepted: { label: "Активно", color: "text-blue-500" },
  completed: { label: "Завершено", color: "text-green-500" },
  expired: { label: "Истекло", color: "text-[var(--text-muted)]" },
  declined: { label: "Отклонено", color: "text-red-400" },
};

export default function MyChallenges() {
  const { user, authFetch } = useUser();
  const [challenges, setChallenges] = useState([]);
  const [tab, setTab] = useState("active"); // active | history
  const [loading, setLoading] = useState(true);
  const [resultModal, setResultModal] = useState(null);

  const userId = user?._id || user?.id;

  useEffect(() => {
    if (!authFetch) return;
    setLoading(true);
    const status = tab === "active" ? "pending,accepted" : "completed,expired,declined";
    // Fetch all statuses for the tab
    Promise.all(
      status.split(",").map((s) =>
        authFetch(`/api/challenges?status=${s}&limit=20`)
          .then((r) => (r.ok ? r.json() : { challenges: [] }))
          .then((d) => d.challenges || [])
      )
    )
      .then((arrays) => {
        const all = arrays.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setChallenges(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch, tab]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 rounded-2xl bg-[var(--bg-elevated)] p-1">
        {[
          { value: "active", label: "Активные" },
          { value: "history", label: "История" },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
              tab === t.value
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">Загрузка...</p>
      ) : challenges.length === 0 ? (
        <div className="text-center py-8">
          <Swords className="h-10 w-10 mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-sm text-[var(--text-muted)]">
            {tab === "active" ? "Нет активных дуэлей" : "История пуста"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {challenges.map((ch) => {
            const isChallenger = ch.challengerId === userId;
            const opponentUsername = isChallenger ? ch.challengedUsername : ch.challengerUsername;
            const opponentAvatarUrl = isChallenger ? ch.challengedAvatarUrl : ch.challengerAvatarUrl;
            const statusInfo = STATUS_LABELS[ch.status] || STATUS_LABELS.pending;
            const isWinner = ch.winnerId === userId;

            return (
              <button
                key={ch.id}
                onClick={() => {
                  if (ch.status === "completed") setResultModal(ch.id);
                }}
                className="w-full flex items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] px-4 py-3 text-left transition hover:border-orange-500/30"
              >
                <UserAvatar username={opponentUsername} avatarUrl={opponentAvatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      vs {opponentUsername}
                    </p>
                    {ch.status === "completed" && isWinner && (
                      <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate">{ch.routeTitle}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                    {ch.stakeCoins > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                        <Coins className="h-3 w-3" />
                        {ch.stakeCoins}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">{timeAgo(ch.createdAt)}</span>
                  </div>
                </div>
                {ch.status === "completed" && (
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <ChallengeResultModal
        isOpen={!!resultModal}
        onClose={() => setResultModal(null)}
        challengeId={resultModal}
      />
    </div>
  );
}
