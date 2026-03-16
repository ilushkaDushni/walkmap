"use client";

import { Trophy, Medal, RotateCcw, Coins } from "lucide-react";
import UserAvatar from "./UserAvatar";

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PLACE_STYLES = {
  1: { height: "h-28", bg: "bg-amber-500/10 border-amber-500/30", textColor: "text-amber-500", label: "1st" },
  2: { height: "h-22", bg: "bg-gray-400/10 border-gray-400/30", textColor: "text-gray-400", label: "2nd" },
  3: { height: "h-18", bg: "bg-orange-600/10 border-orange-600/30", textColor: "text-orange-600", label: "3rd" },
};

/**
 * Подиум результатов гонки.
 * Props: results (from lobby complete), isHost, onRematch, onClose
 */
export default function RacePodium({ results, routeTitle, isHost, onRematch, onClose }) {
  if (!results?.length) return null;

  // Финишировавшие (с местом) и DNF
  const finished = results.filter((r) => r.place && !r.dnf).sort((a, b) => a.place - b.place);
  const dnf = results.filter((r) => r.dnf);

  // Подиум: первые 3 (переставляем для визуала: 2-1-3)
  const podium = [];
  if (finished[1]) podium.push(finished[1]); // 2nd
  if (finished[0]) podium.push(finished[0]); // 1st
  if (finished[2]) podium.push(finished[2]); // 3rd

  return (
    <div className="space-y-4">
      <div className="text-center">
        <Trophy className="h-10 w-10 mx-auto text-amber-500 mb-1" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Результаты гонки</h2>
        <p className="text-xs text-[var(--text-muted)]">{routeTitle}</p>
      </div>

      {/* Подиум визуал */}
      {podium.length > 0 && (
        <div className="flex items-end justify-center gap-2 px-2">
          {podium.map((r) => {
            const style = PLACE_STYLES[r.place] || PLACE_STYLES[3];
            return (
              <div key={r.userId} className="flex-1 max-w-[120px] text-center">
                <UserAvatar
                  username={r.username}
                  avatarUrl={r.avatarUrl}
                  size="md"
                  equippedItems={r.equippedItems}
                />
                <p
                  className="text-xs font-semibold mt-1 truncate"
                  style={{ color: r.equippedItems?.usernameColor?.cssData?.color || "var(--text-primary)" }}
                >
                  {r.username}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{formatDuration(r.duration)}</p>
                <div
                  className={`mt-1 ${style.height} rounded-t-xl border ${style.bg} flex items-center justify-center`}
                >
                  <span className={`text-lg font-black ${style.textColor}`}>
                    {r.place === 1 ? "🥇" : r.place === 2 ? "🥈" : "🥉"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Полная таблица */}
      <div className="space-y-1.5">
        {finished.map((r) => (
          <div
            key={r.userId}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
              r.place <= 3 ? "bg-[var(--bg-elevated)]" : "bg-transparent"
            }`}
          >
            <span className={`text-sm font-bold w-6 text-center ${
              r.place === 1 ? "text-amber-500" :
              r.place === 2 ? "text-gray-400" :
              r.place === 3 ? "text-orange-600" :
              "text-[var(--text-muted)]"
            }`}>
              #{r.place}
            </span>
            <UserAvatar username={r.username} avatarUrl={r.avatarUrl} size="xs" equippedItems={r.equippedItems} />
            <span className="text-sm font-medium text-[var(--text-primary)] flex-1 truncate">{r.username}</span>
            <div className="text-right">
              <p className="text-xs tabular-nums text-[var(--text-secondary)]">{formatDuration(r.duration)}</p>
              {r.coins > 0 && !r.alreadyCompleted && (
                <p className="text-xs text-yellow-500 font-medium flex items-center gap-0.5 justify-end">
                  <Coins className="h-3 w-3" />
                  +{r.coins}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* DNF */}
        {dnf.map((r) => (
          <div key={r.userId} className="flex items-center gap-3 rounded-xl px-3 py-2 opacity-60">
            <span className="text-sm font-bold w-6 text-center text-red-400">DNF</span>
            <UserAvatar username={r.username} avatarUrl={r.avatarUrl} size="xs" equippedItems={r.equippedItems} />
            <span className="text-sm font-medium text-[var(--text-primary)] flex-1 truncate">{r.username}</span>
          </div>
        ))}
      </div>

      {/* New achievements */}
      {results.some((r) => r.newAchievements?.length > 0) && (
        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-2">
          <p className="text-xs font-medium text-purple-500">
            Новые достижения: {results.flatMap((r) => r.newAchievements || []).join(", ")}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        {isHost && (
          <button
            onClick={onRematch}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-green-500/30 py-3 text-sm font-semibold text-green-600 hover:bg-green-500/10 transition"
          >
            <RotateCcw className="h-4 w-4" />
            Реванш
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center rounded-2xl bg-[var(--text-primary)] py-3 text-sm font-semibold text-[var(--bg-surface)] hover:opacity-90 transition"
        >
          Отлично!
        </button>
      </div>
    </div>
  );
}
