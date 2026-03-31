import { MapPin, Users, Route, Trophy, MessageCircle, Gamepad2, Shield, Flame, Smartphone, Compass, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/lib/mongodb";
import { APP_VERSION } from "@/lib/version";
import FeaturesSection from "@/components/about/FeaturesSection";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "О проекте — Ростов GO",
  description: "Ростов GO — PWA-приложение для прогулочных маршрутов по Ростову-на-Дону с геймификацией, мультиплеером и социальными функциями.",
};

async function getStats() {
  try {
    const db = await getDb();
    const [totalUsers, totalRoutes, totalCompletions, totalTracks] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("routes").countDocuments({ status: "published" }),
      db.collection("completed_routes").countDocuments(),
      db.collection("gps_tracks").countDocuments({ status: "finished" }),
    ]);

    const distAgg = await db.collection("completed_routes").aggregate([
      {
        $lookup: {
          from: "routes",
          let: { rid: "$routeId" },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$rid"] } } },
            { $project: { distance: 1 } },
          ],
          as: "route",
        },
      },
      { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$route.distance", 0] } } } },
    ]).toArray();

    const totalDistanceM = distAgg[0]?.total || 0;

    return { totalUsers, totalRoutes, totalCompletions, totalTracks, totalDistanceM };
  } catch {
    return { totalUsers: 0, totalRoutes: 0, totalCompletions: 0, totalTracks: 0, totalDistanceM: 0 };
  }
}

function formatDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

export default async function AboutPage() {
  const stats = await getStats();

  const stack = [
    { name: "Next.js 16", role: "Фреймворк" },
    { name: "React 19", role: "UI" },
    { name: "Tailwind CSS 4", role: "Стили" },
    { name: "MongoDB Atlas", role: "База данных" },
    { name: "MapLibre GL", role: "Карты" },
    { name: "Serwist", role: "PWA / Service Worker" },
    { name: "JWT + bcrypt", role: "Авторизация" },
    { name: "Resend", role: "Email" },
    { name: "Yandex Cloud S3", role: "Медиа-хранилище" },
  ];

  const statCards = [
    { value: stats.totalUsers, label: "Пользователей" },
    { value: stats.totalRoutes, label: "Маршрутов" },
    { value: stats.totalCompletions, label: "Прохождений" },
    { value: formatDist(stats.totalDistanceM), label: "Пройдено", isString: true },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-24">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600/90 via-emerald-500/85 to-teal-400/80 px-5 pt-10 pb-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 text-sm mb-6 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            Назад
          </Link>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md shadow-lg shrink-0">
              <MapPin className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white leading-tight">Ростов GO</h1>
              <p className="text-sm text-white/70 font-medium">Больше, чем просто прогулка</p>
            </div>
          </div>
          <p className="text-sm text-white/80 leading-relaxed max-w-lg">
            PWA-приложение для интерактивных прогулок по Ростову-на-Дону. Исследуйте город через уникальные
            маршруты с GPS-навигацией, зарабатывайте монеты, соревнуйтесь с друзьями и открывайте достижения.
          </p>
        </div>
      </div>

      <div className="relative z-10 -mt-5 rounded-t-3xl bg-[var(--bg-main)] pt-6 px-4 space-y-6">
        {/* Миссия */}
        <div className="glass-card p-5">
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Миссия проекта</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Мотивировать жителей и гостей Ростова-на-Дону к пешим прогулкам, знакомству с историей и
            достопримечательностями города через геймификацию. Приложение превращает обычную прогулку в
            увлекательное приключение с элементами соревнования и социального взаимодействия.
          </p>
        </div>

        {/* Статистика */}
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 px-1">Статистика платформы</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {statCards.map((s) => (
              <div key={s.label} className="glass-card p-4 text-center">
                <div className="text-2xl font-black text-[var(--accent-color)] leading-none">
                  {s.isString ? s.value : s.value.toLocaleString("ru-RU")}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Функции */}
        <FeaturesSection />

        {/* Технический стек */}
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 px-1">Технологии</h2>
          <div className="glass-card p-4">
            <div className="grid grid-cols-3 gap-2.5">
              {stack.map((s) => (
                <div key={s.name} className="text-center py-2">
                  <div className="text-xs font-bold text-[var(--text-primary)]">{s.name}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.role}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Масштаб проекта */}
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 px-1">Масштаб проекта</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { value: "22 700+", label: "Строк кода" },
              { value: "138", label: "API-эндпоинтов" },
              { value: "83", label: "React-компонентов" },
              { value: "30", label: "Достижений" },
              { value: "19", label: "Пермишенов" },
              { value: "13+", label: "Коллекций MongoDB" },
            ].map((s) => (
              <div key={s.label} className="glass-card p-3 flex items-center gap-3">
                <span className="text-lg font-black text-[var(--accent-color)]">{s.value}</span>
                <span className="text-xs text-[var(--text-muted)] font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-[var(--text-muted)]">Ростов GO v{APP_VERSION} · 2026</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Разработано для конкурса им. Вернадского</p>
        </div>
      </div>
    </div>
  );
}
