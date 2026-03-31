"use client";

import { useState, useMemo, useEffect } from "react";
import { useUser } from "@/components/UserProvider";
import RouteCard from "@/components/RouteCard";
import { LogIn, MapPin, ArrowUpDown, SlidersHorizontal, Flame } from "lucide-react";
import Link from "next/link";

const SORT_OPTIONS = [
  { id: "default", label: "По умолчанию" },
  { id: "distance_asc", label: "Ближе → дальше" },
  { id: "distance_desc", label: "Дальше → ближе" },
  { id: "newest", label: "Новые" },
  { id: "name", label: "По имени" },
];

const DIFFICULTY_FILTERS = [
  { id: null, label: "Все" },
  { id: "easy", label: "Лёгкий", color: "text-green-500" },
  { id: "medium", label: "Средний", color: "text-yellow-500" },
  { id: "hard", label: "Сложный", color: "text-red-500" },
];

export default function RoutesListClient({ routes: initialRoutes }) {
  const { user, authFetch, hasPermission } = useUser();
  const isAdmin = hasPermission("routes.view_hidden");
  const [routes, setRoutes] = useState(initialRoutes);
  const [sortBy, setSortBy] = useState("default");
  const [difficulty, setDifficulty] = useState(null);
  const [showSort, setShowSort] = useState(false);
  const [bestTimes, setBestTimes] = useState({});

  // Загружаем лучшие времена юзера для всех маршрутов
  useEffect(() => {
    if (!user) return;
    authFetch("/api/routes/my-records")
      .then((r) => r.ok ? r.json() : {})
      .then((data) => setBestTimes(data))
      .catch(() => {});
  }, [user, authFetch]);

  const visible = isAdmin ? routes : routes.filter((r) => !r._hidden);

  const filtered = useMemo(() => {
    let result = difficulty
      ? visible.filter((r) => r.difficulty === difficulty)
      : visible;

    switch (sortBy) {
      case "distance_asc":
        result = [...result].sort((a, b) => (a.distance || 0) - (b.distance || 0));
        break;
      case "distance_desc":
        result = [...result].sort((a, b) => (b.distance || 0) - (a.distance || 0));
        break;
      case "newest":
        result = [...result].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case "name":
        result = [...result].sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));
        break;
      default:
        break;
    }
    return result;
  }, [visible, sortBy, difficulty]);

  if (!user) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
          <MapPin className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Войдите, чтобы увидеть маршруты</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)] max-w-xs">
          Зарегистрируйтесь или войдите в аккаунт, чтобы просматривать и проходить маршруты
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
          className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-lg)] transition hover:shadow-[var(--shadow-md)] active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4" />
          Войти / Зарегистрироваться
        </button>
      </div>
    );
  }

  const published = filtered.filter((r) => !r._hidden);
  const hidden = filtered.filter((r) => r._hidden);

  const handleToggleHidden = async (routeId, hide) => {
    setRoutes((prev) =>
      prev.map((r) =>
        r._id === routeId ? { ...r, adminOnly: hide, _hidden: hide } : r
      )
    );
    const res = await authFetch(`/api/routes/${routeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminOnly: hide }),
    });
    if (!res.ok) {
      setRoutes((prev) =>
        prev.map((r) =>
          r._id === routeId ? { ...r, adminOnly: !hide, _hidden: !hide } : r
        )
      );
    }
  };

  if (visible.length === 0) return null;

  return (
    <div className="space-y-3 pb-24">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {DIFFICULTY_FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            onClick={() => setDifficulty(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              difficulty === f.id
                ? "bg-[var(--text-primary)] text-[var(--bg-main)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-color)]"
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* Heatmap link */}
        <Link
          href="/heatmap"
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20 transition"
        >
          <Flame className="h-3 w-3" />
          Тепловая карта
        </Link>

        {/* Sort button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowSort((v) => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              sortBy !== "default"
                ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-color)]"
            }`}
          >
            <ArrowUpDown className="h-3 w-3" />
            Сортировка
          </button>
          {showSort && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] py-1 overflow-hidden">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortBy(opt.id); setShowSort(false); }}
                    className={`flex items-center w-full px-3 py-2 text-xs transition ${
                      sortBy === opt.id
                        ? "text-[var(--accent-color)] font-medium bg-[var(--accent-color)]/5"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Routes grid */}
      <div className="grid gap-4">
        {published.map((route) => (
          <RouteCard
            key={route._id}
            route={route}
            isAdmin={isAdmin}
            onToggleHidden={handleToggleHidden}
            bestTime={bestTimes[route._id]}
          />
        ))}
      </div>

      {isAdmin && hidden.length > 0 && (
        <>
          <p className="text-xs text-[var(--text-muted)] mt-2">Скрытые маршруты</p>
          <div className="grid gap-4">
            {hidden.map((route) => (
              <RouteCard
                key={route._id}
                route={route}
                isAdmin={isAdmin}
                onToggleHidden={handleToggleHidden}
                bestTime={bestTimes[route._id]}
              />
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <SlidersHorizontal className="h-10 w-10 mx-auto text-[var(--text-muted)] mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-muted)]">Ничего не найдено</p>
          <button onClick={() => { setDifficulty(null); setSortBy("default"); }} className="mt-2 text-xs text-[var(--accent-color)] font-medium">
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}
