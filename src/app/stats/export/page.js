"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Download, Trophy, Route, Clock, Coins, Users } from "lucide-react";
import Link from "next/link";

function formatDuration(seconds) {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м ${s}с`;
}

function formatDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} км`;
  return `${Math.round(m)} м`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function StatsExportPage() {
  const { user, authFetch } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/stats/export")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authFetch]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <p className="text-[var(--text-muted)]">Войдите в аккаунт</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <p className="text-[var(--text-muted)]">Загрузка статистики...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <p className="text-[var(--text-muted)]">Ошибка загрузки</p>
      </div>
    );
  }

  const unlockedAch = data.achievements.filter((a) => a.unlocked);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] print:bg-white">
      {/* Шапка (скрывается при печати) */}
      <div className="print:hidden flex items-center justify-between px-4 pt-4 pb-2">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-color)] text-white text-sm font-semibold active:scale-95 transition"
        >
          <Download className="w-4 h-4" />
          Сохранить PDF
        </button>
      </div>

      {/* Контент для печати */}
      <div className="max-w-2xl mx-auto px-4 py-6 print:px-8 print:py-4">
        {/* Заголовок */}
        <div className="text-center mb-8 print:mb-6">
          <h1 className="text-2xl font-black text-[var(--text-primary)] print:text-black">Ростов GO</h1>
          <p className="text-sm text-[var(--text-muted)] print:text-gray-500 mt-1">Статистика игрока</p>
          <div className="mt-3 inline-block px-4 py-1.5 rounded-full bg-[var(--accent-light)] print:bg-gray-100 print:border print:border-gray-300">
            <span className="text-sm font-bold text-[var(--accent-color)] print:text-gray-800">{data.user.username}</span>
          </div>
          {data.user.createdAt && (
            <p className="text-xs text-[var(--text-muted)] print:text-gray-400 mt-2">
              В игре с {formatDate(data.user.createdAt)}
            </p>
          )}
        </div>

        {/* Основная статистика */}
        <div className="grid grid-cols-2 gap-3 mb-6 print:mb-4">
          {[
            { icon: Route, label: "Маршрутов пройдено", value: data.stats.completedRoutes },
            { icon: Route, label: "Общая дистанция", value: formatDist(data.stats.totalDistanceM) },
            { icon: Clock, label: "Время в пути", value: formatDuration(data.stats.totalDurationS) },
            { icon: Coins, label: "Монет заработано", value: data.stats.totalCoinsEarned.toLocaleString("ru-RU") },
            { icon: Trophy, label: "Достижений", value: `${unlockedAch.length}/${data.achievements.length}` },
            { icon: Users, label: "Друзей", value: data.stats.friendsCount },
          ].map((s) => {
            const Ic = s.icon;
            return (
              <div key={s.label} className="glass-card p-3 print:border print:border-gray-200 print:rounded-lg print:bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <Ic className="w-3.5 h-3.5 text-[var(--accent-color)] print:text-gray-600" />
                  <span className="text-[10px] text-[var(--text-muted)] print:text-gray-500 font-medium">{s.label}</span>
                </div>
                <div className="text-lg font-black text-[var(--text-primary)] print:text-black">{s.value}</div>
              </div>
            );
          })}
        </div>

        {/* Рекорды */}
        {data.records.length > 0 && (
          <div className="mb-6 print:mb-4">
            <h2 className="text-base font-bold text-[var(--text-primary)] print:text-black mb-3">Лучшие результаты</h2>
            <div className="glass-card print:border print:border-gray-200 print:rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] print:border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[var(--text-muted)] print:text-gray-500">Маршрут</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--text-muted)] print:text-gray-500">Время</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[var(--text-muted)] print:text-gray-500 hidden sm:table-cell print:table-cell">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border-color)]/30 print:border-gray-100 last:border-0">
                      <td className="py-2 px-3 text-[var(--text-primary)] print:text-black font-medium">
                        {r.routeTitle}
                        <span className="text-xs text-[var(--text-muted)] print:text-gray-400 ml-1">({formatDist(r.distance)})</span>
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--accent-color)] print:text-gray-800 font-bold">{formatDuration(r.duration)}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-muted)] print:text-gray-400 text-xs hidden sm:table-cell print:table-cell">{formatDate(r.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Достижения */}
        {unlockedAch.length > 0 && (
          <div className="mb-6 print:mb-4">
            <h2 className="text-base font-bold text-[var(--text-primary)] print:text-black mb-3">Открытые достижения</h2>
            <div className="grid grid-cols-2 gap-2">
              {unlockedAch.map((a) => (
                <div key={a.title} className="glass-card p-3 print:border print:border-gray-200 print:rounded-lg">
                  <div className="text-sm font-bold text-[var(--text-primary)] print:text-black">{a.title}</div>
                  <div className="text-xs text-[var(--text-muted)] print:text-gray-500 mt-0.5">{a.description}</div>
                  <div className="text-[10px] text-[var(--accent-color)] print:text-gray-600 mt-1 font-medium">+{a.reward} монет</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Футер */}
        <div className="text-center pt-4 border-t border-[var(--border-color)] print:border-gray-200">
          <p className="text-xs text-[var(--text-muted)] print:text-gray-400">
            Ростов GO · Сгенерировано {formatDate(data.generatedAt)}
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          nav, [data-bottom-nav] { display: none !important; }
          .glass-card { background: white !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        }
      `}</style>
    </div>
  );
}
