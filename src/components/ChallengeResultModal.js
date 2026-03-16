"use client";

import { useEffect, useState } from "react";
import { X, Swords, Trophy, Coins } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChallengeResultModal({ isOpen, onClose, challengeId }) {
  const { user, authFetch } = useUser();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !challengeId || !authFetch) return;
    setLoading(true);
    authFetch(`/api/challenges/${challengeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setChallenge(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, challengeId, authFetch]);

  if (!isOpen) return null;

  const userId = user?._id || user?.id;
  const isWinner = challenge?.winnerId === userId;
  const isDraw = challenge?.status === "completed" && !challenge?.winnerId;

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[85] mx-auto max-w-md"
        style={{ animation: "lobby-spring 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
      >
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-lg)]">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-5 w-5" />
          </button>

          {loading || !challenge ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
          ) : (
            <>
              <div className="text-center mb-4">
                {isDraw ? (
                  <Swords className="h-12 w-12 mx-auto text-[var(--text-muted)] mb-2" />
                ) : isWinner ? (
                  <Trophy className="h-12 w-12 mx-auto text-amber-500 mb-2" />
                ) : (
                  <Swords className="h-12 w-12 mx-auto text-red-400 mb-2" />
                )}
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {isDraw ? "Ничья!" : isWinner ? "Победа!" : "Поражение"}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">{challenge.routeTitle}</p>
              </div>

              {/* Результаты */}
              <div className="space-y-3 mb-4">
                {/* Challenger */}
                <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                  challenge.winnerId === challenge.challengerId
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-[var(--bg-elevated)]"
                }`}>
                  <UserAvatar
                    username={challenge.challengerUsername}
                    avatarUrl={challenge.challengerAvatarUrl}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {challenge.challengerUsername}
                      {challenge.winnerId === challenge.challengerId && " 🏆"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDuration(challenge.challengerResult?.duration)}
                    </p>
                  </div>
                </div>

                <div className="text-center text-xs font-bold text-[var(--text-muted)]">VS</div>

                {/* Challenged */}
                <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                  challenge.winnerId === challenge.challengedId
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-[var(--bg-elevated)]"
                }`}>
                  <UserAvatar
                    username={challenge.challengedUsername}
                    avatarUrl={challenge.challengedAvatarUrl}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {challenge.challengedUsername}
                      {challenge.winnerId === challenge.challengedId && " 🏆"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {challenge.challengedResult
                        ? formatDuration(challenge.challengedResult.duration)
                        : "Ещё не прошёл"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Награда */}
              {challenge.stakeCoins > 0 && challenge.winnerId && (
                <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-yellow-500 mb-4">
                  <Coins className="h-4 w-4" />
                  {isWinner ? `+${challenge.stakeCoins * 2} монет` : `-${challenge.stakeCoins} монет`}
                </div>
              )}
              {isDraw && challenge.stakeCoins > 0 && (
                <p className="text-center text-xs text-[var(--text-muted)] mb-4">
                  Ставки возвращены
                </p>
              )}

              <button
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--text-primary)] py-3 text-sm font-semibold text-[var(--bg-surface)] hover:opacity-90 transition"
              >
                Закрыть
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
