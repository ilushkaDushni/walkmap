"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Footprints, Ruler, Coins, Trophy, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES } from "@/lib/achievements";
import { formatDist, ICON_MAP } from "./helpers";

export default function LeaderModal({ username, onClose }) {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    fetch(`/api/users/${username}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => null)
      .finally(() => setLoadingData(false));
  }, [username]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  const stats = data?.stats || {};
  const dist = formatDist(stats.totalDistanceM || 0);
  const achievementSlugs = new Set(data?.achievements || []);
  const unlockedCount = achievementSlugs.size;
  const topRole = data?.roles?.length > 0 ? data.roles[data.roles.length - 1] : null;
  const displayRoles = (data?.roles || []).filter((r) => r.slug !== "user");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-75"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleClose} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-[var(--bg-elevated)] transition z-10">
          <X className="h-4 w-4 text-[var(--text-muted)]" />
        </button>

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">Не удалось загрузить</div>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <UserAvatar username={data.username} avatarUrl={data.avatarUrl} roleColor={topRole?.color} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">{data.username}</h3>
                {displayRoles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {displayRoles.map((r) => (
                      <span key={r.slug} className="inline-block text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: r.color, backgroundColor: `${r.color}20` }}>
                        {r.name}
                      </span>
                    ))}
                  </div>
                )}
                {data.bio && <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{data.bio}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-blue-500/15 to-sky-500/5 border border-[var(--border-color)] py-3 px-2">
                <Footprints className="h-5 w-5 text-blue-500 mb-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{stats.completedRoutes || 0}</span>
                <span className="text-xs text-[var(--text-secondary)]">Маршрутов</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-green-500/5 border border-[var(--border-color)] py-3 px-2">
                <Ruler className="h-5 w-5 text-emerald-500 mb-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{dist.value}</span>
                <span className="text-xs text-[var(--text-secondary)]">{dist.unit}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-yellow-500/15 to-amber-500/5 border border-[var(--border-color)] py-3 px-2">
                <Coins className="h-5 w-5 text-yellow-500 mb-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{stats.coins || 0}</span>
                <span className="text-xs text-[var(--text-secondary)]">Монеты</span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Достижения</span>
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {unlockedCount}<span className="text-[var(--text-muted)]">/{ACHIEVEMENT_REGISTRY.length}</span>
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {ACHIEVEMENT_REGISTRY.map((a) => {
                  const ok = achievementSlugs.has(a.slug);
                  const Icon = ICON_MAP[a.icon] || Trophy;
                  const colors = COLOR_CLASSES[a.color] || COLOR_CLASSES.blue;
                  return (
                    <div key={a.slug} title={`${a.title}${ok ? " (получено)" : ""}`} className={`flex flex-col items-center rounded-lg py-2 px-1 transition ${ok ? colors.bg : "opacity-40"}`}>
                      <Icon className={`h-4 w-4 ${ok ? colors.text : "text-[var(--text-muted)]"}`} />
                      <span className={`text-xs font-medium mt-0.5 text-center leading-tight ${ok ? colors.text : "text-[var(--text-muted)]"}`}>{a.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link href={`/users/${data.username}`} onClick={handleClose} className="flex items-center justify-center gap-1.5 mt-4 w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
              Открыть профиль
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
