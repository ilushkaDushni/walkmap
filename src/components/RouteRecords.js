"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, Timer, Medal, Users } from "lucide-react";
import { useUser } from "@/components/UserProvider";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(paceSeconds) {
  if (!paceSeconds || paceSeconds <= 0) return "—";
  const m = Math.floor(paceSeconds / 60);
  const s = paceSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")} мин/км`;
}

const MEDAL_COLORS = [
  "text-yellow-500", // gold
  "text-gray-400",   // silver
  "text-amber-600",  // bronze
];

export default function RouteRecords({ routeId }) {
  const { authFetch, user } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeId || !user) return;
    let cancelled = false;

    authFetch(`/api/routes/${routeId}/records`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [routeId, user, authFetch]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 animate-pulse">
        <div className="h-5 w-32 rounded bg-[var(--bg-elevated)] mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-xl bg-[var(--bg-elevated)]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || (!data.myBest && data.records?.length === 0)) return null;

  const { records = [], myBest, totalCompletions } = data;

  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] overflow-hidden">
      {/* Заголовок */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">Рекорды</h3>
        </div>
        {totalCompletions > 0 && (
          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Users className="h-3.5 w-3.5" />
            {totalCompletions} прохождений
          </span>
        )}
      </div>

      {/* Персональный рекорд */}
      {myBest && (
        <div className="mx-4 mb-3 rounded-xl bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[var(--accent-color)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Ваш рекорд</span>
            </div>
            {myBest.rank && (
              <span className="rounded-full bg-[var(--accent-color)]/20 px-2 py-0.5 text-xs font-bold text-[var(--accent-color)]">
                #{myBest.rank}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-xl font-bold text-[var(--text-primary)]">{formatDuration(myBest.duration)}</span>
            {myBest.pace > 0 && (
              <span className="text-xs text-[var(--text-muted)]">{formatPace(myBest.pace)}</span>
            )}
          </div>
        </div>
      )}

      {/* Таблица лидеров */}
      {records.length > 0 && (
        <div className="px-4 pb-4">
          <div className="space-y-1">
            {records.map((rec, i) => {
              const isMe = rec.userId === user?._id;
              return (
                <Link
                  href={`/users/${rec.username}`}
                  key={`${rec.userId}-${i}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
                    isMe ? "bg-[var(--accent-color)]/5" : "hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {/* Место */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {i < 3 ? (
                      <Medal className={`h-5 w-5 ${MEDAL_COLORS[i]}`} />
                    ) : (
                      <span className="text-sm font-medium text-[var(--text-muted)]">{i + 1}</span>
                    )}
                  </div>

                  {/* Аватар */}
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                    {rec.avatarUrl ? (
                      <img src={rec.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                        {rec.username?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Имя */}
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm truncate block ${isMe ? "font-bold text-[var(--accent-color)]" : "text-[var(--text-primary)]"}`}>
                      {rec.username || "Аноним"}
                    </span>
                  </div>

                  {/* Время и темп */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[var(--text-primary)]">{formatDuration(rec.duration)}</div>
                    {rec.pace > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)]">{formatPace(rec.pace)}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
