"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Users, Route, Trophy, Coins, TrendingUp, Clock, FileText, MapPin } from "lucide-react";

export default function AdminStatsPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !hasPermission("admin.access")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  useEffect(() => {
    if (!hasPermission("admin.access")) return;
    (async () => {
      const res = await authFetch("/api/admin/stats");
      if (res.ok) setStats(await res.json());
      setLoadingData(false);
    })();
  }, [user, authFetch, hasPermission]);

  if (loading || !hasPermission("admin.access")) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/admin/routes")}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Статистика</h1>
          <p className="text-sm text-[var(--text-muted)]">Аналитика сайта</p>
        </div>
      </div>

      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : !stats ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Не удалось загрузить</p>
      ) : (
        <div className="space-y-6">
          {/* Пользователи */}
          <Section title="Пользователи" icon={Users}>
            <div className="grid grid-cols-2 gap-2">
              <Card label="Всего" value={stats.users.total} icon={Users} />
              <Card label="Новые за 7 дней" value={stats.users.newWeek} icon={TrendingUp} />
              <Card label="Активные за 7 дней" value={stats.users.activeWeek} icon={TrendingUp} />
              <Card label="Монет в системе" value={stats.users.totalCoins} icon={Coins} color="text-amber-500" />
            </div>
          </Section>

          {/* Маршруты */}
          <Section title="Маршруты" icon={Route}>
            <div className="grid grid-cols-2 gap-2">
              <Card label="Опубликовано" value={stats.routes.published} icon={MapPin} />
              <Card label="Черновиков" value={stats.routes.drafts} icon={FileText} />
              <Card
                label="Общая дистанция"
                value={formatDistance(stats.routes.totalDistanceM)}
                icon={Route}
              />
              <Card
                label="Среднее время"
                value={stats.routes.avgDurationMin ? `${stats.routes.avgDurationMin} мин` : "—"}
                icon={Clock}
              />
            </div>
          </Section>

          {/* Прохождения */}
          <Section title="Прохождения" icon={Trophy}>
            <div className="grid grid-cols-2 gap-2">
              <Card label="Всего" value={stats.completions.total} icon={Trophy} />
              <div />
              {stats.completions.topRoute && (
                <WideCard
                  label="Топ маршрут"
                  name={stats.completions.topRoute.title}
                  count={stats.completions.topRoute.count}
                  icon={MapPin}
                />
              )}
              {stats.completions.topUser && (
                <WideCard
                  label="Топ пользователь"
                  name={stats.completions.topUser.username}
                  count={stats.completions.topUser.count}
                  icon={Users}
                />
              )}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-[var(--text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Card({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color || "text-[var(--text-muted)]"}`} />
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
      </div>
      <p className={`text-lg font-bold ${color || "text-[var(--text-primary)]"}`}>{value}</p>
    </div>
  );
}

function WideCard({ label, name, count, icon: Icon }) {
  return (
    <div className="col-span-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)]">
        <Icon className="h-5 w-5 text-[var(--text-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>
      </div>
      <p className="text-lg font-bold text-[var(--text-primary)]">{count}</p>
    </div>
  );
}

function formatDistance(meters) {
  if (!meters) return "0 м";
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}
