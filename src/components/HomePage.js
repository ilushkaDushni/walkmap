"use client";

import { useEffect, useState, useRef } from "react";
import {
  MapPin, Route, Ruler, Coins, ArrowRight, Users,
  Footprints, Trophy, Compass, Map, Sun, Cloud,
  CloudRain, CloudSnow, CloudLightning,
  Medal, Crown, Star, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@/components/UserProvider";
import CountUp from "@/components/CountUp";

// ─── useInView ──────────────────────────────────────────────────
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

// ─── Helpers ────────────────────────────────────────────────────
function formatDist(m) {
  if (m >= 1000) return { value: Math.round(m / 100) / 10, unit: "км" };
  return { value: m, unit: "м" };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

const LEVELS = [
  { min: 0, title: "Начинающий", color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-elevated)]" },
  { min: 1, title: "Новичок", color: "text-green-500", bg: "bg-green-500/10" },
  { min: 5, title: "Путешественник", color: "text-blue-500", bg: "bg-blue-500/10" },
  { min: 10, title: "Исследователь", color: "text-purple-500", bg: "bg-purple-500/10" },
  { min: 20, title: "Легенда", color: "text-yellow-500", bg: "bg-yellow-500/10" },
];

function getUserLevel(c) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (c >= l.min) lvl = l; }
  return lvl;
}

function getLevelProgress(c) {
  const idx = LEVELS.findIndex((l) => c < l.min);
  if (idx === -1) return { pct: 100, next: null };
  const prev = LEVELS[idx - 1]?.min || 0;
  return { pct: Math.round(((c - prev) / (LEVELS[idx].min - prev)) * 100), next: LEVELS[idx] };
}

const ACHIEVEMENTS = [
  { icon: Footprints, title: "Первые шаги", desc: "Пройти 1 маршрут", check: (s) => s.completedRoutes >= 1, color: "text-blue-500", bg: "bg-blue-500/10" },
  { icon: Coins, title: "Коллекционер", desc: "50 монет", check: (s) => s.coins >= 50, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { icon: Compass, title: "Путник", desc: "5 маршрутов", check: (s) => s.completedRoutes >= 5, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { icon: Ruler, title: "Марафонец", desc: "5 км", check: (s) => s.totalDistanceM >= 5000, color: "text-orange-500", bg: "bg-orange-500/10" },
  { icon: Map, title: "Знаток", desc: "10 маршрутов", check: (s) => s.completedRoutes >= 10, color: "text-purple-500", bg: "bg-purple-500/10" },
  { icon: Trophy, title: "Богач", desc: "500 монет", check: (s) => s.coins >= 500, color: "text-red-500", bg: "bg-red-500/10" },
];

function getWeatherIcon(code) {
  if (code <= 1) return { Icon: Sun, color: "text-yellow-400", gradient: "from-yellow-500/20 to-orange-500/10" };
  if (code <= 3) return { Icon: Cloud, color: "text-blue-400", gradient: "from-blue-500/15 to-sky-500/10" };
  if (code <= 48) return { Icon: Cloud, color: "text-gray-400", gradient: "from-gray-500/15 to-slate-500/10" };
  if (code <= 67) return { Icon: CloudRain, color: "text-blue-500", gradient: "from-blue-500/20 to-indigo-500/10" };
  if (code <= 86) return { Icon: CloudSnow, color: "text-sky-300", gradient: "from-sky-500/15 to-blue-500/10" };
  return { Icon: CloudLightning, color: "text-purple-500", gradient: "from-purple-500/20 to-violet-500/10" };
}

function getWeatherTip(code, temp) {
  if (code >= 95) return "Лучше остаться дома";
  if (code >= 61 && code <= 67) return "Возьмите зонт!";
  if (code >= 71) return "Оденьтесь теплее";
  if (temp > 25) return "Возьмите воду!";
  if (temp > 15) return "Идеально для прогулки!";
  if (temp > 5) return "Одевайтесь теплее";
  return "Холодно, но гулять можно";
}

// ─── StatCard (цветной фон) ─────────────────────────────────────
function StatCard({ icon: Icon, value, label, suffix, gradient, iconColor, delay = 0, inView }) {
  return (
    <div
      className={`animate-scale-in flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} border border-[var(--border-color)] py-4 px-2`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Icon className={`mb-1 h-6 w-6 ${iconColor}`} />
      <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
        {inView ? <CountUp end={value} suffix={suffix} /> : "0"}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] text-center">{label}</div>
    </div>
  );
}

// ─── WeatherWidget ──────────────────────────────────────────────
function WeatherWidget({ weather }) {
  if (!weather) return null;
  const { Icon, color, gradient } = getWeatherIcon(weather.code);
  const tip = getWeatherTip(weather.code, weather.temp);
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-gradient-to-r ${gradient} border border-[var(--border-color)] px-4 py-3`}>
      <Icon className={`h-9 w-9 ${color} shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-[var(--text-primary)]">{Math.round(weather.temp)}°</span>
          <span className="text-sm text-[var(--text-secondary)] truncate">{tip}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)]">Ростов-на-Дону</div>
      </div>
    </div>
  );
}

// ─── RouteOfDay ─────────────────────────────────────────────────
function RouteOfDay({ route }) {
  if (!route) return null;
  const dist = formatDist(route.distance || 0);
  return (
    <Link
      href={`/routes/${route._id}`}
      className="block rounded-2xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/20 p-4 transition hover:from-orange-500/20 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/20 shrink-0">
          <Star className="h-5 w-5 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Маршрут дня</div>
          <div className="text-base font-bold text-[var(--text-primary)] truncate">{route.title}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-orange-400 shrink-0" />
      </div>
      <div className="flex gap-4 mt-2 ml-14 text-xs text-[var(--text-muted)]">
        {route.distance > 0 && <span>{dist.value} {dist.unit}</span>}
        {route.duration > 0 && <span>{route.duration} мин</span>}
        {route.checkpoints?.length > 0 && <span>{route.checkpoints.length} точек</span>}
      </div>
    </Link>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-6">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-elevated)]" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
        <div className="h-14 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
    </div>
  );
}

// ─── SectionTitle ───────────────────────────────────────────────
function SectionTitle({ children }) {
  return <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{children}</h2>;
}

// ─── GuestView ──────────────────────────────────────────────────
function GuestView({ publicStats, weather, routeOfDay }) {
  const [ref, inView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [bottomRef, bottomInView] = useInView();
  const dist = formatDist(publicStats.totalDistanceM);

  return (
    <div className="px-4 pt-8 pb-4 space-y-5" ref={ref}>
      {/* Герой */}
      <div className={`text-center ${inView ? "animate-fade-in-up" : "opacity-0"}`}>
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
          <MapPin className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Ростов GO</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Больше, чем просто прогулка</p>
      </div>

      {/* Статистика */}
      <div ref={statsRef} className={`grid grid-cols-3 gap-3 ${statsInView ? "" : "opacity-0"}`}>
        <StatCard icon={Route} value={publicStats.totalRoutes} label="Маршрутов" gradient="from-green-500/15 to-emerald-500/5" iconColor="text-green-500" delay={0} inView={statsInView} />
        <StatCard icon={Ruler} value={dist.value} label={dist.unit} gradient="from-blue-500/15 to-sky-500/5" iconColor="text-blue-500" delay={100} inView={statsInView} />
        <StatCard icon={Users} value={publicStats.totalUsers} label="Гуляют" gradient="from-purple-500/15 to-violet-500/5" iconColor="text-purple-500" delay={200} inView={statsInView} />
      </div>

      {/* Погода */}
      <WeatherWidget weather={weather} />

      {/* Фичи */}
      <div ref={bottomRef} className={`space-y-2 ${bottomInView ? "animate-fade-in-up" : "opacity-0"}`}>
        {[
          { icon: Compass, text: "Аудиогид и чекпоинты на маршруте", gradient: "from-green-500/10 to-transparent" },
          { icon: Coins, text: "Зарабатывайте монеты за прохождение", gradient: "from-yellow-500/10 to-transparent" },
          { icon: Trophy, text: "Достижения и система уровней", gradient: "from-purple-500/10 to-transparent" },
        ].map(({ icon: Icon, text, gradient }, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-xl bg-gradient-to-r ${gradient} border border-[var(--border-color)] px-4 py-3`}>
            <Icon className="h-5 w-5 text-green-500 shrink-0" />
            <span className="text-sm text-[var(--text-secondary)]">{text}</span>
          </div>
        ))}
      </div>

      {/* Маршрут дня */}
      <RouteOfDay route={routeOfDay} />

      {/* CTA */}
      <button
        onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-500/20 transition hover:shadow-green-500/30 active:scale-[0.98]"
      >
        Войти и начать
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

// ─── AuthenticatedView ──────────────────────────────────────────
function AuthenticatedView({ user, userStats, publicStats, weather, routeOfDay, leaders }) {
  const [topRef, topInView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [midRef, midInView] = useInView();
  const [bottomRef, bottomInView] = useInView();

  const dist = formatDist(userStats.totalDistanceM);
  const level = getUserLevel(userStats.completedRoutes);
  const progress = getLevelProgress(userStats.completedRoutes);
  const unlockedCount = ACHIEVEMENTS.filter((a) => a.check(userStats)).length;

  return (
    <div className="space-y-5 px-4 pt-5 pb-4">
      {/* Приветствие + уровень */}
      <div ref={topRef} className={`${topInView ? "animate-fade-in-up" : "opacity-0"}`}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {getGreeting()}, {user.username}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${level.bg} ${level.color}`}>
            <Trophy className="h-3 w-3" />
            {level.title}
          </span>
          {progress.next && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-2 flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-1000" style={{ width: `${progress.pct}%` }} />
              </div>
              <span className="text-[10px] text-[var(--text-muted)] shrink-0">{progress.next.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Личная статистика */}
      <div ref={statsRef} className={`grid grid-cols-3 gap-3 ${statsInView ? "" : "opacity-0"}`}>
        <StatCard icon={Footprints} value={userStats.completedRoutes} label="Пройдено" gradient="from-blue-500/15 to-sky-500/5" iconColor="text-blue-500" delay={0} inView={statsInView} />
        <StatCard icon={Ruler} value={dist.value} label={dist.unit} gradient="from-emerald-500/15 to-green-500/5" iconColor="text-emerald-500" delay={100} inView={statsInView} />
        <StatCard icon={Coins} value={userStats.coins} label="Монеты" gradient="from-yellow-500/15 to-amber-500/5" iconColor="text-yellow-500" delay={200} inView={statsInView} />
      </div>

      {/* Погода */}
      <WeatherWidget weather={weather} />

      {/* Действия */}
      <div ref={midRef} className={`space-y-3 ${midInView ? "animate-fade-in-up" : "opacity-0"}`}>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/routes"
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/5 border border-green-500/20 px-4 py-3.5 transition hover:from-green-500/20 active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20 shrink-0">
              <Map className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">Маршруты</div>
              <div className="text-[10px] text-[var(--text-muted)]">Выбрать прогулку</div>
            </div>
          </Link>
          <button
            onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/5 border border-blue-500/20 px-4 py-3.5 transition hover:from-blue-500/20 active:scale-[0.98] text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 shrink-0">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">Профиль</div>
              <div className="text-[10px] text-[var(--text-muted)]">Ваш аккаунт</div>
            </div>
          </button>
        </div>

        {/* Маршрут дня */}
        <RouteOfDay route={routeOfDay} />
      </div>

      {/* Достижения */}
      <div ref={bottomRef} className={`space-y-3 ${bottomInView ? "animate-fade-in-up" : "opacity-0"}`}>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Достижения</SectionTitle>
            <span className="text-sm font-bold text-[var(--text-primary)]">{unlockedCount}<span className="text-[var(--text-muted)]">/{ACHIEVEMENTS.length}</span></span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ACHIEVEMENTS.map((a, i) => {
              const ok = a.check(userStats);
              return (
                <div key={i} className={`flex flex-col items-center rounded-xl py-2.5 px-1 transition ${ok ? a.bg : "bg-[var(--bg-elevated)] opacity-50"}`} title={`${a.title}: ${a.desc}`}>
                  <a.icon className={`h-5 w-5 ${ok ? a.color : "text-[var(--text-muted)]"}`} />
                  <span className={`text-[9px] font-medium mt-1 text-center leading-tight ${ok ? a.color : "text-[var(--text-muted)]"}`}>{a.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Лидеры */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <SectionTitle>Лидеры</SectionTitle>
          {leaders.length === 0 ? (
            <div className="py-6 text-center text-sm text-[var(--text-muted)]">Станьте первым!</div>
          ) : (
            <div className="mt-3 space-y-2">
              {leaders.map((l, i) => {
                const icons = [Crown, Medal, Medal];
                const colors = ["text-yellow-500", "text-gray-400", "text-orange-400"];
                const bgs = ["bg-yellow-500/10", "bg-gray-500/10", "bg-orange-500/10"];
                const LeaderIcon = icons[i] || Medal;
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-xl ${bgs[i]} px-3 py-2`}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                      <LeaderIcon className={`h-4 w-4 ${colors[i]}`} />
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{l.username}</span>
                    <span className="text-sm font-bold text-[var(--text-muted)]">{l.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading, authFetch } = useUser();
  const [publicStats, setPublicStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [weather, setWeather] = useState(null);
  const [routeOfDay, setRouteOfDay] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/public").then((r) => r.json()).catch(() => ({ totalRoutes: 0, totalDistanceM: 0, totalUsers: 0 })),
      fetch("https://api.open-meteo.com/v1/forecast?latitude=47.2357&longitude=39.7015&current=temperature_2m,weather_code&timezone=Europe/Moscow")
        .then((r) => r.json())
        .then((d) => ({ temp: d.current.temperature_2m, code: d.current.weather_code }))
        .catch(() => null),
      fetch("/api/routes/featured").then((r) => r.json()).catch(() => ({ routes: [], manual: false })),
    ]).then(([stats, w, featured]) => {
      setPublicStats(stats);
      setWeather(w);
      if (featured.manual && featured.route) {
        setRouteOfDay(featured.route);
      } else if (Array.isArray(featured.routes) && featured.routes.length > 0) {
        const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        setRouteOfDay(featured.routes[day % featured.routes.length]);
      }
    });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { setDataLoading(false); return; }

    setDataLoading(true);
    Promise.all([
      authFetch("/api/stats/user").then((r) => r.json()).catch(() => ({ completedRoutes: 0, totalDistanceM: 0, coins: 0 })),
      fetch("/api/stats/leaderboard").then((r) => r.json()).catch(() => []),
    ]).then(([stats, lb]) => {
      setUserStats(stats);
      setLeaders(Array.isArray(lb) ? lb : []);
    }).finally(() => setDataLoading(false));
  }, [user, loading]);

  if (loading || !publicStats || (user && dataLoading)) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return <GuestView publicStats={publicStats} weather={weather} routeOfDay={routeOfDay} />;
  }

  return (
    <AuthenticatedView
      user={user}
      userStats={userStats || { completedRoutes: 0, totalDistanceM: 0, coins: 0 }}
      publicStats={publicStats}
      weather={weather}
      routeOfDay={routeOfDay}
      leaders={leaders}
    />
  );
}
