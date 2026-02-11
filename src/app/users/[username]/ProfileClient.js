"use client";

import Link from "next/link";
import { ChevronLeft, Footprints, Ruler, Coins, Trophy, Shield, Map, Compass } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES } from "@/lib/achievements";

const ICON_MAP = { Footprints, Coins, Compass, Ruler, Map, Trophy };

function formatDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} км`;
  return `${m} м`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ru-RU", { year: "numeric", month: "long" });
}

export default function ProfileClient({ profile }) {
  const { username, avatarUrl, bio, createdAt, roles, stats, achievements } = profile;
  const primaryRoleColor = roles?.[0]?.color || null;
  const achievementSet = new Set(achievements);

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
    </div>
  );
}
