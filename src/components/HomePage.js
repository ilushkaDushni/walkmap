"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MapPin, Route, Ruler, Coins, ArrowRight, Users,
  Footprints, Trophy, Compass, Map, Sun, Cloud,
  CloudRain, CloudSnow, CloudLightning,
  Medal, Crown, Star, ChevronRight,
  Shield, Zap, Flame, Globe, Gem, MessageCircle, Moon, X,
} from "lucide-react";
import Link from "next/link";
import { useUser } from "@/components/UserProvider";
import CountUp from "@/components/CountUp";
import UserAvatar from "@/components/UserAvatar";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES } from "@/lib/achievements";

const ICON_MAP = {
  Footprints, Coins, Compass, Ruler, Map, Trophy,
  Shield, Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
};

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
  { min: 0, title: "Начинающий", desc: "Вы только начали свой путь", color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-elevated)]" },
  { min: 1, title: "Новичок", desc: "Пройдите 1 маршрут", color: "text-green-500", bg: "bg-green-500/10" },
  { min: 5, title: "Путешественник", desc: "Пройдите 5 маршрутов", color: "text-blue-500", bg: "bg-blue-500/10" },
  { min: 10, title: "Исследователь", desc: "Пройдите 10 маршрутов", color: "text-purple-500", bg: "bg-purple-500/10" },
  { min: 20, title: "Легенда", desc: "Пройдите 20 маршрутов", color: "text-yellow-500", bg: "bg-yellow-500/10" },
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

// Достижения теперь из реестра (src/lib/achievements.js)

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
function RouteOfDay({ route, onClick }) {
  if (!route) return null;
  const dist = formatDist(route.distance || 0);
  const Tag = onClick ? "button" : Link;
  const tagProps = onClick ? { onClick, type: "button" } : { href: `/routes/${route._id}` };
  return (
    <Tag
      {...tagProps}
      className="block w-full text-left rounded-2xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/20 p-4 transition hover:from-orange-500/20 active:scale-[0.99]"
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
    </Tag>
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
      <RouteOfDay route={routeOfDay} onClick={() => window.dispatchEvent(new Event("open-profile-modal"))} />

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
// ─── AchievementModal ────────────────────────────────────────────
function AchievementModal({ achievement, unlocked, userStats, onClose }) {
  const [visible, setVisible] = useState(false);
  const Icon = ICON_MAP[achievement.icon] || Trophy;
  const colors = COLOR_CLASSES[achievement.color] || COLOR_CLASSES.blue;
  const prog = achievement.progress(userStats);
  const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-xl transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleClose} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-[var(--bg-elevated)] transition">
          <X className="h-4 w-4 text-[var(--text-muted)]" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${unlocked ? colors.bg : "bg-[var(--bg-elevated)]"} mb-3`}>
            <Icon className={`h-8 w-8 ${unlocked ? colors.text : "text-[var(--text-muted)]"}`} />
          </div>

          <h3 className={`text-lg font-bold ${unlocked ? colors.text : "text-[var(--text-primary)]"}`}>
            {achievement.title}
          </h3>

          <p className="text-sm text-[var(--text-secondary)] mt-1">{achievement.desc}</p>

          {achievement.flavor && (
            <p className="text-xs text-[var(--text-muted)] italic mt-2">&laquo;{achievement.flavor}&raquo;</p>
          )}

          {/* Прогресс */}
          <div className="w-full mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--text-muted)]">Прогресс</span>
              <span className={`font-bold ${unlocked ? colors.text : "text-[var(--text-secondary)]"}`}>
                {prog.current}/{prog.target}{prog.unit ? ` ${prog.unit}` : ""}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${unlocked ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-[var(--text-muted)]/30"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Награда */}
          <div className={`flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full ${unlocked ? "bg-yellow-500/10" : "bg-[var(--bg-elevated)]"}`}>
            <Coins className={`h-4 w-4 ${unlocked ? "text-yellow-500" : "text-[var(--text-muted)]"}`} />
            <span className={`text-sm font-bold ${unlocked ? "text-yellow-500" : "text-[var(--text-muted)]"}`}>
              {unlocked ? "+" : ""}{achievement.reward}
            </span>
          </div>

          {unlocked && (
            <span className="text-xs text-green-500 font-medium mt-2">Получено!</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AchievementCard (compact) ──────────────────────────────────
function AchievementCard({ achievement, unlocked, userStats, onClick }) {
  const Icon = ICON_MAP[achievement.icon] || Trophy;
  const colors = COLOR_CLASSES[achievement.color] || COLOR_CLASSES.blue;
  const prog = achievement.progress(userStats);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl py-2.5 px-1 transition active:scale-95 select-none outline-none ${unlocked ? colors.bg : "bg-[var(--bg-elevated)] opacity-50"}`}
    >
      <Icon className={`h-5 w-5 ${unlocked ? colors.text : "text-[var(--text-muted)]"}`} />
      <span className={`text-[9px] font-medium mt-1 text-center leading-tight ${unlocked ? colors.text : "text-[var(--text-muted)]"}`}>
        {achievement.title}
      </span>
      <span className={`text-[8px] mt-0.5 ${unlocked ? colors.text : "text-[var(--text-muted)]"}`}>
        {prog.current}/{prog.target}{prog.unit ? ` ${prog.unit}` : ""}
      </span>
    </button>
  );
}

// ─── LeaderModal ────────────────────────────────────────────────
function LeaderModal({ username, onClose }) {
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

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xl transition-all duration-200 ${
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
            {/* Header: аватар + имя + роль */}
            <div className="flex items-center gap-3 mb-4">
              <UserAvatar username={data.username} avatarUrl={data.avatarUrl} roleColor={topRole?.color} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">{data.username}</h3>
                {topRole && (
                  <span
                    className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5"
                    style={{ color: topRole.color, backgroundColor: `${topRole.color}20` }}
                  >
                    {topRole.name}
                  </span>
                )}
                {data.bio && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{data.bio}</p>
                )}
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-blue-500/15 to-sky-500/5 border border-[var(--border-color)] py-3 px-2">
                <Footprints className="h-5 w-5 text-blue-500 mb-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{stats.completedRoutes || 0}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Маршрутов</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-green-500/5 border border-[var(--border-color)] py-3 px-2">
                <Ruler className="h-5 w-5 text-emerald-500 mb-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{dist.value}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">{dist.unit}</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-gradient-to-br from-yellow-500/15 to-amber-500/5 border border-[var(--border-color)] py-3 px-2">
                <Coins className="h-5 w-5 text-yellow-500 mb-1" />
                <span className="text-lg font-bold text-[var(--text-primary)]">{stats.coins || 0}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Монеты</span>
              </div>
            </div>

            {/* Достижения */}
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
                    <div
                      key={a.slug}
                      title={`${a.title}${ok ? " (получено)" : ""}`}
                      className={`flex flex-col items-center rounded-lg py-2 px-1 transition ${
                        ok ? colors.bg : "opacity-30"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${ok ? colors.text : "text-[var(--text-muted)]"}`} />
                      <span className={`text-[7px] font-medium mt-0.5 text-center leading-tight ${ok ? colors.text : "text-[var(--text-muted)]"}`}>
                        {a.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ссылка на профиль */}
            <Link
              href={`/users/${data.username}`}
              onClick={handleClose}
              className="flex items-center justify-center gap-1.5 mt-4 w-full rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
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

function AuthenticatedView({ user, userStats, publicStats, weather, routeOfDay, leaders }) {
  const [topRef, topInView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [midRef, midInView] = useInView();
  const [bottomRef, bottomInView] = useInView();
  const [achExpanded, setAchExpanded] = useState(false);
  const [selectedAch, setSelectedAch] = useState(null);
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [levelsOpen, setLevelsOpen] = useState(false);

  const dist = formatDist(userStats.totalDistanceM);
  const level = getUserLevel(userStats.completedRoutes);
  const progress = getLevelProgress(userStats.completedRoutes);
  const completedRoutes = userStats.completedRoutes;
  const dbSlugs = new Set(userStats.achievements || []);
  const unlockedSlugs = new Set([
    ...dbSlugs,
    ...ACHIEVEMENT_REGISTRY.filter((a) => a.check(userStats)).map((a) => a.slug),
  ]);
  const unlockedCount = unlockedSlugs.size;

  return (
    <div className="space-y-5 px-4 pt-5 pb-4">
      {/* Приветствие + уровень */}
      <div ref={topRef} className={`${topInView ? "animate-fade-in-up" : "opacity-0"}`}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {getGreeting()}, {user.username}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setLevelsOpen(true)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${level.bg} ${level.color} transition hover:opacity-80 active:scale-95`}
          >
            <Trophy className="h-3 w-3" />
            {level.title}
          </button>
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
            <span className="text-sm font-bold text-[var(--text-primary)]">{unlockedCount}<span className="text-[var(--text-muted)]">/{ACHIEVEMENT_REGISTRY.length}</span></span>
          </div>

          {/* Первые 3 всегда видны */}
          <div className="grid grid-cols-3 gap-2">
            {ACHIEVEMENT_REGISTRY.slice(0, 3).map((a) => {
              const ok = unlockedSlugs.has(a.slug) || a.check(userStats);
              return (
                <AchievementCard key={a.slug} achievement={a} unlocked={ok} userStats={userStats} onClick={() => setSelectedAch(a)} />
              );
            })}
          </div>

          {/* Остальные — по раскрытию */}
          {ACHIEVEMENT_REGISTRY.length > 3 && (
            <>
              <div
                className={`grid grid-cols-3 gap-2 overflow-hidden transition-all duration-300 ${
                  achExpanded ? "mt-2 max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                {ACHIEVEMENT_REGISTRY.slice(3).map((a) => {
                  const ok = unlockedSlugs.has(a.slug) || a.check(userStats);
                  return (
                    <AchievementCard key={a.slug} achievement={a} unlocked={ok} userStats={userStats} onClick={() => setSelectedAch(a)} />
                  );
                })}
              </div>

              <button
                onClick={() => setAchExpanded((v) => !v)}
                className="flex items-center justify-center gap-1 w-full mt-2 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
              >
                {achExpanded ? "Свернуть" : `Ещё ${ACHIEVEMENT_REGISTRY.length - 3}`}
                <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${achExpanded ? "-rotate-90" : "rotate-90"}`} />
              </button>
            </>
          )}
        </div>

        {/* Модалка достижения */}
        {selectedAch && (
          <AchievementModal
            achievement={selectedAch}
            unlocked={unlockedSlugs.has(selectedAch.slug) || selectedAch.check(userStats)}
            userStats={userStats}
            onClose={() => setSelectedAch(null)}
          />
        )}

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
                  <button
                    key={i}
                    onClick={() => setSelectedLeader(l.username)}
                    className={`flex items-center gap-3 rounded-xl ${bgs[i]} px-3 py-2 w-full text-left transition active:scale-[0.98] hover:opacity-80 select-none outline-none`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                      <LeaderIcon className={`h-4 w-4 ${colors[i]}`} />
                    </div>
                    <UserAvatar username={l.username} avatarUrl={l.avatarUrl} size="sm" />
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">
                      {l.username}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-muted)]">{l.count}</span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Модалка лидера */}
        {selectedLeader && (
          <LeaderModal username={selectedLeader} onClose={() => setSelectedLeader(null)} />
        )}

        {/* Модалка уровней */}
        {levelsOpen && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setLevelsOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Звания</h3>
                <button onClick={() => setLevelsOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                {LEVELS.map((lvl, i) => {
                  const isCurrent = lvl.title === level.title;
                  const isUnlocked = completedRoutes >= lvl.min;
                  const nextLvl = LEVELS[i + 1];
                  const pct = nextLvl
                    ? Math.min(100, Math.round(((completedRoutes - lvl.min) / (nextLvl.min - lvl.min)) * 100))
                    : 100;

                  return (
                    <div
                      key={lvl.title}
                      className={`rounded-xl border p-3 transition ${
                        isCurrent
                          ? "border-[var(--accent-color)] bg-[var(--accent-color)]/5"
                          : isUnlocked
                          ? "border-[var(--border-color)] bg-[var(--bg-elevated)]/50"
                          : "border-[var(--border-color)] opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${lvl.bg} shrink-0`}>
                          <Trophy className={`h-4 w-4 ${lvl.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${lvl.color}`}>{lvl.title}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-1.5 py-0.5 rounded">Сейчас</span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)]">{lvl.desc}</p>
                        </div>
                        {isUnlocked && !isCurrent && (
                          <span className="text-green-500 text-[10px] font-bold shrink-0">✓</span>
                        )}
                      </div>
                      {isCurrent && nextLvl && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${Math.max(0, pct)}%` }} />
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] shrink-0">{completedRoutes}/{nextLvl.min}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

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
      userStats={userStats || { completedRoutes: 0, totalDistanceM: 0, coins: 0, commentsCount: 0, hasNightCompletion: false, achievements: [] }}
      publicStats={publicStats}
      weather={weather}
      routeOfDay={routeOfDay}
      leaders={leaders}
    />
  );
}
