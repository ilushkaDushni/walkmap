"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MapPin, Route, Ruler, Coins, ArrowRight, Users,
  Footprints, Trophy, Compass, Map, Sun, Cloud,
  CloudRain, CloudSnow, CloudLightning,
  Medal, Crown, Star, ChevronRight,
  Shield, Zap, Flame, Globe, Gem, MessageCircle, Moon, X, LifeBuoy,
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

// Правдоподобное число онлайн: зависит от часа дня, не превышает totalUsers
function calcOnlineCount(totalUsers) {
  const total = totalUsers || 0;
  if (total === 0) return 0;
  const hour = new Date().getHours();
  // Коэффициент активности по часу (пик 12-18ч)
  const mult =
    hour >= 10 && hour <= 20 ? 0.15 + 0.1 * Math.sin(((hour - 10) / 10) * Math.PI)
    : hour >= 7 && hour < 10 ? 0.08
    : hour >= 21 && hour <= 23 ? 0.07
    : 0.03;
  // Seed от минуты для стабильности при перерендерах
  const seed = Math.floor(Date.now() / 60000);
  const rng = ((seed * 9301 + 49297) % 233280) / 233280;
  // Базовое число: процент от юзеров + небольшой случайный сдвиг
  const raw = total * mult + rng * Math.min(total * 0.1, 3);
  // Минимум 1, максимум totalUsers
  return Math.min(total, Math.max(1, Math.round(raw)));
}

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

// ─── OnlineStatCard (для гостевой статистики) ───────────────────
function OnlineStatCard({ delay, inView, totalUsers }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(calcOnlineCount(totalUsers));
  }, [totalUsers]);

  return (
    <div
      className={`animate-scale-in flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/15 to-violet-500/5 border border-[var(--border-color)] py-4 px-2`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative">
        <Users className="mb-1 h-6 w-6 text-purple-500" />
        <span className="absolute -top-1 -right-1.5 flex h-2.5 w-2.5">
          <span className="absolute inset-0 rounded-full bg-green-400 animate-online-dot" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
        {inView ? <CountUp end={count} /> : "0"}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] text-center">Онлайн</div>
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

// ─── DustParticles — эффект пылинок с дрейфом ──────────────────
function DustParticles({ count = 30 }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: 1.5 + Math.random() * 3.5,
      opacity: 0.2 + Math.random() * 0.5,
      anim: `dust-${1 + (i % 4)}`,
      dur: 5 + Math.random() * 7,
      delay: Math.random() * 6,
    }))
  ).current;

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            "--dust-o": p.opacity,
            animation: `${p.anim} ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

// ─── OnlineCounter ──────────────────────────────────────────────
function OnlineCounter({ totalUsers }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(calcOnlineCount(totalUsers));
  }, [totalUsers]);

  if (!count) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2.5 px-4 animate-fade-in-up">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 rounded-full bg-green-400 animate-online-dot" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      <span className="text-sm text-[var(--text-secondary)]">
        Сейчас гуляют <span className="font-bold text-[var(--text-primary)]">{count}</span> человек
      </span>
    </div>
  );
}

// ─── ReviewsSection ─────────────────────────────────────────────
const GRADIENTS = [
  "from-blue-500 to-sky-500",
  "from-pink-500 to-rose-500",
  "from-green-500 to-emerald-500",
  "from-purple-500 to-violet-500",
  "from-orange-500 to-amber-500",
  "from-teal-500 to-cyan-500",
];

function ReviewsSection({ onWriteReview }) {
  const [ref, inView] = useInView();
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!inView || loaded) return;
    fetch("/api/reviews?limit=6&featured=true")
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [inView, loaded]);

  if (loaded && reviews.length === 0) return null;

  return (
    <div ref={ref} className={`${inView ? "animate-fade-in-up" : "opacity-0"}`}>
      <div className="flex items-center justify-between">
        <SectionTitle>Отзывы</SectionTitle>
        {onWriteReview && (
          <button
            onClick={onWriteReview}
            className="text-xs font-medium text-green-500 hover:text-green-400 transition"
          >
            Написать →
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-2 -mx-4 px-4 pb-1">
        {reviews.map((r, i) => (
          <div
            key={r.id}
            className="shrink-0 w-[72vw] max-w-[280px] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 animate-scale-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center gap-3 mb-3">
              {r.avatarUrl ? (
                <img src={r.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} shrink-0`}>
                  <span className="text-sm font-bold text-white">{(r.username || "?")[0].toUpperCase()}</span>
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{r.username}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, j) => (
                    <span key={j} className={`text-xs ${j < r.rating ? "text-yellow-400" : "text-[var(--text-muted)]/30"}`}>&#9733;</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GuestView ──────────────────────────────────────────────────
function GuestView({ publicStats, weather, routeOfDay, featuredRoutes }) {
  const [heroRef, heroInView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [stepsRef, stepsInView] = useInView();
  const [featRef, featInView] = useInView();
  const [routesRef, routesInView] = useInView();
  const [ctaRef, ctaInView] = useInView();
  const dist = formatDist(publicStats.totalDistanceM);

  return (
    <div className="pb-4 space-y-5">
      {/* ═══ ГЕРОЙ — большой градиентный баннер ═══ */}
      <div ref={heroRef} className={`relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-500 to-teal-500 animate-gradient px-6 pt-12 pb-8 text-center ${heroInView ? "animate-fade-in-up" : "opacity-0"}`}>
        {/* Пылинки */}
        <DustParticles count={35} />
        {/* Крупные полупрозрачные круги фона */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm animate-glow">
            <MapPin className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">Ростов GO</h1>
          <p className="mt-2 text-base text-white/80 font-medium">Больше, чем просто прогулка</p>

          {/* Инлайн-статистика в герое */}
          <div className="flex justify-center mt-5">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5">
              <Route className="h-3.5 w-3.5 text-white/80" />
              <span className="text-xs font-bold text-white">{publicStats.totalRoutes} маршрутов</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ СЕЙЧАС ГУЛЯЮТ ═══ */}
      <OnlineCounter totalUsers={publicStats.totalUsers} />

      <div className="px-4 space-y-5">
        {/* ═══ СТАТИСТИКА — анимированные карточки ═══ */}
        <div ref={statsRef} className={`grid grid-cols-3 gap-3 ${statsInView ? "" : "opacity-0"}`}>
          <StatCard icon={Route} value={publicStats.totalRoutes} label="Маршрутов" gradient="from-green-500/15 to-emerald-500/5" iconColor="text-green-500" delay={0} inView={statsInView} />
          <StatCard icon={Ruler} value={dist.value} label={dist.unit} gradient="from-blue-500/15 to-sky-500/5" iconColor="text-blue-500" delay={100} inView={statsInView} />
          <OnlineStatCard delay={200} inView={statsInView} totalUsers={publicStats.totalUsers} />
        </div>

        {/* ═══ ПОГОДА ═══ */}
        <WeatherWidget weather={weather} />

        {/* ═══ КАК ЭТО РАБОТАЕТ — 3 шага ═══ */}
        <div ref={stepsRef} className={`${stepsInView ? "animate-fade-in-up" : "opacity-0"}`}>
          <SectionTitle>Как это работает</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5 mt-3">
            {[
              { num: "1", icon: Map, title: "Выберите", desc: "маршрут", gradient: "from-green-500 to-emerald-500" },
              { num: "2", icon: Compass, title: "Следуйте", desc: "чекпоинтам", gradient: "from-blue-500 to-sky-500" },
              { num: "3", icon: Trophy, title: "Получите", desc: "награды", gradient: "from-yellow-500 to-amber-500" },
            ].map(({ num, icon: Ic, title, desc, gradient }, i) => (
              <div key={i} className="flex flex-col items-center text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-3 animate-scale-in" style={{ animationDelay: `${i * 120}ms` }}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-white text-sm font-black mb-2 shadow-sm`}>
                  {num}
                </div>
                <Ic className="h-5 w-5 text-[var(--text-secondary)] mb-1" />
                <span className="text-xs font-bold text-[var(--text-primary)] leading-tight">{title}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ ВОЗМОЖНОСТИ — сетка 2x2 ═══ */}
        <div ref={featRef} className={`${featInView ? "animate-fade-in-up" : "opacity-0"}`}>
          <SectionTitle>Возможности</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { icon: Footprints, title: "GPS-трекинг", desc: "Отслеживайте прогресс в реальном времени", color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
              { icon: Coins, title: "Монеты", desc: "Зарабатывайте за каждый маршрут", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
              { icon: Trophy, title: "Достижения", desc: "Более 15 наград и уровни", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
              { icon: Users, title: "Друзья", desc: "Гуляйте вместе, дарите подарки", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { icon: Gem, title: "Магазин", desc: "Рамки, титулы, темы оформления", color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
              { icon: MessageCircle, title: "Общение", desc: "Комментарии и личные сообщения", color: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20" },
            ].map(({ icon: Ic, title, desc, color, bg, border }, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-2xl ${border} border bg-[var(--bg-surface)] p-3.5 animate-scale-in`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} shrink-0`}>
                  <Ic className={`h-4.5 w-4.5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-[var(--text-primary)] block leading-tight">{title}</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ ОТЗЫВЫ ═══ */}
        <ReviewsSection onWriteReview={() => window.dispatchEvent(new Event("open-profile-modal"))} />

        {/* ═══ МАРШРУТ ДНЯ ═══ */}
        <RouteOfDay route={routeOfDay} onClick={() => window.dispatchEvent(new Event("open-profile-modal"))} />

        {/* ═══ РЕКОМЕНДУЕМЫЕ МАРШРУТЫ ═══ */}
        <div ref={routesRef} className={`${routesInView ? "animate-fade-in-up" : "opacity-0"}`}>
          <FeaturedRoutesGallery routes={featuredRoutes} asGuest />
        </div>

        {/* ═══ СОЦИАЛЬНОЕ ДОКАЗАТЕЛЬСТВО + CTA ═══ */}
        <div ref={ctaRef} className={`space-y-4 ${ctaInView ? "animate-fade-in-up" : "opacity-0"}`}>
          {/* Аватарки + текст */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex -space-x-2">
              {["from-green-400 to-emerald-500", "from-blue-400 to-sky-500", "from-purple-400 to-violet-500", "from-orange-400 to-amber-500", "from-pink-400 to-rose-500"].map((g, i) => (
                <div key={i} className={`h-8 w-8 rounded-full border-2 border-[var(--bg-main)] bg-gradient-to-br ${g} flex items-center justify-center`}>
                  <span className="text-[10px] text-white/80 font-bold">{["А", "Д", "И", "М", "К"][i]}</span>
                </div>
              ))}
              <div className="h-8 w-8 rounded-full border-2 border-[var(--bg-main)] bg-[var(--bg-elevated)] flex items-center justify-center">
                <span className="text-[9px] text-[var(--text-muted)] font-bold">+{Math.max(0, (publicStats.totalUsers || 5) - 5)}</span>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] text-center">
              Присоединяйтесь к <span className="font-bold text-[var(--text-primary)]">{publicStats.totalUsers || 0}+</span> пользователям
            </p>
          </div>

          {/* CTA кнопка */}
          <button
            onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
            className="btn-shine w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-500/20 transition hover:shadow-green-500/30 active:scale-[0.98]"
          >
            Начать бесплатно
            <ArrowRight className="h-5 w-5" />
          </button>

          {/* Мини-преимущества */}
          <div className="flex justify-center gap-4 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Бесплатно</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Без рекламы</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Оффлайн</span>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="text-center pt-3 pb-2">
          <p className="text-[11px] text-[var(--text-muted)]">
            Ростов GO · 2026
          </p>
          <button
            onClick={() => window.dispatchEvent(new Event("open-about-screen"))}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition underline underline-offset-2"
          >
            О приложении
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TutorialRewardOverlay ────────────────────────────────────────
function TutorialRewardOverlay() {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | in | show | out

  useEffect(() => {
    const handler = (e) => {
      const reward = e.detail?.amount || 100;
      setAmount(reward);
      setVisible(true);
      setPhase("in");
      setTimeout(() => setPhase("show"), 50);
      setTimeout(() => setPhase("out"), 3200);
      setTimeout(() => { setVisible(false); setPhase("idle"); }, 3800);
    };
    window.addEventListener("tutorial-reward", handler);
    return () => window.removeEventListener("tutorial-reward", handler);
  }, []);

  if (!visible) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[300] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${phase === "out" ? "opacity-0" : phase !== "idle" ? "opacity-100" : "opacity-0"}`}>
      <style>{`
        @keyframes tr-bg { 0%{opacity:0} 100%{opacity:1} }
        @keyframes tr-coin-pop { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.2) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes tr-text-up { 0%{transform:translateY(30px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes tr-number { 0%{transform:scale(0.3);opacity:0} 50%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes tr-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes tr-ring { 0%{transform:scale(0.5);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes tr-sparkle { 0%{transform:translate(-50%,-50%) scale(0);opacity:1} 50%{opacity:1} 100%{transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(0.5);opacity:0} }
      `}</style>

      {/* Soft backdrop */}
      <div className="absolute inset-0 bg-black/40" style={{ animation: "tr-bg 0.4s ease-out both" }} />

      {/* Content */}
      <div className="relative flex flex-col items-center">
        {/* Expanding rings */}
        {[0, 0.3, 0.6].map((d, i) => (
          <div
            key={i}
            className="absolute w-32 h-32 rounded-full border-2 border-yellow-400/30"
            style={{ animation: `tr-ring 1.5s ease-out ${d}s infinite` }}
          />
        ))}

        {/* Coin icon */}
        <div
          className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-2xl shadow-yellow-500/40"
          style={{ animation: "tr-coin-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both" }}
        >
          <Coins size={44} className="text-white drop-shadow-lg" />

          {/* Sparkle particles */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const r = 70 + Math.random() * 50;
            return (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-yellow-300"
                style={{
                  left: "50%", top: "50%",
                  "--sx": `${Math.cos(angle) * r}px`,
                  "--sy": `${Math.sin(angle) * r}px`,
                  animation: `tr-sparkle 0.8s ease-out ${0.4 + i * 0.04}s both`,
                }}
              />
            );
          })}
        </div>

        {/* Amount */}
        <div
          className="mt-5 text-5xl font-black"
          style={{
            background: "linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)",
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "tr-number 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.5s both, tr-shimmer 2s linear 1s infinite",
          }}
        >
          +{amount}
        </div>

        {/* Label */}
        <p
          className="mt-2 text-lg font-bold text-white/90"
          style={{ animation: "tr-text-up 0.5s ease-out 0.7s both" }}
        >
          Монет за обучение!
        </p>

        <p
          className="mt-1 text-sm text-white/50"
          style={{ animation: "tr-text-up 0.5s ease-out 0.9s both" }}
        >
          Добро пожаловать в Ростов GO
        </p>
      </div>
    </div>,
    document.body
  );
}

// ─── AuthenticatedView ──────────────────────────────────────────
// ─── FeaturedRoutesGallery ───────────────────────────────────────
const ROUTE_COLORS = [
  "from-green-500/15 to-emerald-500/5 border-green-500/20",
  "from-blue-500/15 to-sky-500/5 border-blue-500/20",
  "from-purple-500/15 to-violet-500/5 border-purple-500/20",
  "from-orange-500/15 to-amber-500/5 border-orange-500/20",
];
const ROUTE_ICONS = ["text-green-500", "text-blue-500", "text-purple-500", "text-orange-500"];

function FeaturedRoutesGallery({ routes, asGuest }) {
  if (!routes || routes.length === 0) return null;
  return (
    <div>
      <SectionTitle>Рекомендуемые</SectionTitle>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-2 -mx-4 px-4 pb-1">
        {routes.map((route, i) => {
          const dist = formatDist(route.distance || 0);
          const Tag = asGuest ? "button" : Link;
          const tagProps = asGuest
            ? { onClick: () => window.dispatchEvent(new Event("open-profile-modal")), type: "button" }
            : { href: `/routes/${route._id}` };
          return (
            <Tag
              key={route._id}
              {...tagProps}
              className={`shrink-0 w-52 rounded-2xl bg-gradient-to-br ${ROUTE_COLORS[i % ROUTE_COLORS.length]} border p-3.5 text-left transition hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className={`h-4 w-4 ${ROUTE_ICONS[i % ROUTE_ICONS.length]} shrink-0`} />
                <span className="text-sm font-bold text-[var(--text-primary)] truncate">{route.title}</span>
              </div>
              <div className="flex gap-3 text-[11px] text-[var(--text-muted)]">
                {route.distance > 0 && <span>{dist.value} {dist.unit}</span>}
                {route.duration > 0 && <span>{route.duration} мин</span>}
                {route.checkpoints?.length > 0 && <span>{route.checkpoints.length} точек</span>}
              </div>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

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

function AuthenticatedView({ user, userStats, publicStats, weather, routeOfDay, leaders, featuredRoutes }) {
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

  const weatherData = weather ? getWeatherIcon(weather.code) : null;
  const weatherTip = weather ? getWeatherTip(weather.code, weather.temp) : null;
  const WeatherIc = weatherData?.Icon;

  return (
    <div className="pb-24">
      <TutorialRewardOverlay />
      {/* ═══ HERO — персональная карточка с градиентом ═══ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-500 to-teal-500 animate-gradient px-5 pt-10 pb-8">
        {/* Пылинки */}
        <DustParticles count={30} />
        {/* Крупные полупрозрачные круги фона */}
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative z-10">
          {/* Аватар + Приветствие */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-full ring-2 ring-white/30 p-0.5">
                <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="lg" equippedItems={user.equippedItems} />
              </div>
              <button
                onClick={() => setLevelsOpen(true)}
                className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow-lg transition active:scale-95 ${
                  level.title === "Легенда" ? "bg-gradient-to-r from-yellow-500 to-amber-500"
                  : level.title === "Исследователь" ? "bg-gradient-to-r from-purple-500 to-violet-500"
                  : level.title === "Путешественник" ? "bg-gradient-to-r from-blue-500 to-sky-500"
                  : level.title === "Новичок" ? "bg-gradient-to-r from-green-600 to-emerald-700"
                  : "bg-white/20 backdrop-blur-sm"
                }`}
              >
                {level.title}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/70 font-medium">{getGreeting()}</p>
              <h1 className="text-2xl font-black text-white truncate leading-tight">{user.username}</h1>
              {user.equippedItems?.title?.cssData?.text && (
                <span className="text-xs text-white/60 font-medium">{user.equippedItems.title.cssData.text}</span>
              )}
            </div>
          </div>

          {/* Прогресс уровня */}
          {progress.next && (
            <div className="mt-5">
              <div className="flex justify-between text-[11px] text-white/60 mb-1.5">
                <span>{level.title}</span>
                <span>{completedRoutes}/{progress.next.min} → {progress.next.title}</span>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all duration-1000" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="rounded-xl bg-white/15 backdrop-blur-sm px-2 py-2.5 text-center">
              <div className="text-xl font-black text-white leading-none">{userStats.completedRoutes}</div>
              <div className="text-[10px] text-white/60 mt-0.5">Маршрутов</div>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur-sm px-2 py-2.5 text-center">
              <div className="text-xl font-black text-white leading-none">{dist.value}<span className="text-sm font-bold"> {dist.unit}</span></div>
              <div className="text-[10px] text-white/60 mt-0.5">Пройдено</div>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur-sm px-2 py-2.5 text-center">
              <div className="text-xl font-black text-white leading-none">{userStats.coins}</div>
              <div className="text-[10px] text-white/60 mt-0.5">Монеты 🪙</div>
            </div>
          </div>

          {/* Маршрутики */}
          {(user.routiks || 0) > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-white/70 text-xs">
              <span>🔷</span>
              <span className="font-bold text-white">{user.routiks}</span>
              <span>маршрутиков</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Основной контент — перекрывает hero снизу ═══ */}
      <div className="relative z-10 -mt-4 rounded-t-3xl bg-[var(--bg-main)] pt-5 px-4 space-y-4">

        {/* ═══ BENTO: Погода + Маршрут дня ═══ */}
        {(weather || routeOfDay) && (
          <div className={`grid gap-3 ${weather && routeOfDay ? "grid-cols-5" : "grid-cols-1"}`}>
            {weather && WeatherIc && (
              <div className={`${routeOfDay ? "col-span-2" : ""} rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-3.5 shadow-lg animate-scale-in`}>
                <WeatherIc className={`h-8 w-8 ${weatherData.color} mb-1`} />
                <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{Math.round(weather.temp)}°</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">{weatherTip}</div>
              </div>
            )}
            {routeOfDay && (
              <Link
                href={`/routes/${routeOfDay._id}`}
                className={`${weather ? "col-span-3" : ""} rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/5 border border-orange-500/20 p-3.5 shadow-lg transition hover:from-orange-500/20 active:scale-[0.98] animate-scale-in`}
                style={{ animationDelay: "80ms" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Маршрут дня</span>
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">{routeOfDay.title}</div>
                <div className="flex gap-3 mt-1.5 text-[11px] text-[var(--text-muted)]">
                  {routeOfDay.distance > 0 && <span>{formatDist(routeOfDay.distance).value} {formatDist(routeOfDay.distance).unit}</span>}
                  {routeOfDay.duration > 0 && <span>{routeOfDay.duration} мин</span>}
                  {routeOfDay.checkpoints?.length > 0 && <span>{routeOfDay.checkpoints.length} точек</span>}
                </div>
              </Link>
            )}
          </div>
        )}

        {/* ═══ QUICK ACTIONS — 4 иконки ═══ */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Map, title: "Маршруты", gradient: "from-green-500 to-emerald-500", bg: "bg-green-500/10", href: "/routes" },
            { icon: Users, title: "Друзья", gradient: "from-blue-500 to-sky-500", bg: "bg-blue-500/10", href: "/friends" },
            { icon: Gem, title: "Магазин", gradient: "from-pink-500 to-rose-500", bg: "bg-pink-500/10", href: "/shop" },
            { icon: Trophy, title: "Профиль", gradient: "from-purple-500 to-violet-500", bg: "bg-purple-500/10", onClick: () => window.dispatchEvent(new Event("open-profile-modal")) },
          ].map(({ icon: Ic, title, gradient, bg, href, onClick }, i) => {
            const Tag = href ? Link : "button";
            const tagProps = href ? { href } : { onClick, type: "button" };
            return (
              <Tag
                key={title}
                {...tagProps}
                className={`flex flex-col items-center gap-1.5 rounded-2xl ${bg} border border-[var(--border-color)] py-3 px-2 transition hover:scale-[1.02] active:scale-95 animate-scale-in`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
                  <Ic className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{title}</span>
              </Tag>
            );
          })}
        </div>

        {/* ═══ FEATURED ROUTES ═══ */}
        <FeaturedRoutesGallery routes={featuredRoutes} />

        {/* ═══ ACHIEVEMENTS — горизонтальный скролл ═══ */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Достижения</SectionTitle>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {unlockedCount}<span className="text-[var(--text-muted)]">/{ACHIEVEMENT_REGISTRY.length}</span>
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {ACHIEVEMENT_REGISTRY.map((a) => {
              const ok = unlockedSlugs.has(a.slug) || a.check(userStats);
              const Ic = ICON_MAP[a.icon] || Trophy;
              const colors = COLOR_CLASSES[a.color] || COLOR_CLASSES.blue;
              return (
                <button
                  key={a.slug}
                  onClick={() => setSelectedAch(a)}
                  className="shrink-0 flex flex-col items-center w-14 transition active:scale-90 select-none outline-none"
                >
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${ok ? colors.bg : "bg-[var(--bg-elevated)] opacity-40"}`}>
                    <Ic className={`h-5 w-5 ${ok ? colors.text : "text-[var(--text-muted)]"}`} />
                  </div>
                  <span className={`text-[8px] font-medium mt-1 text-center leading-tight line-clamp-2 ${ok ? colors.text : "text-[var(--text-muted)]"}`}>
                    {a.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ LEADERBOARD — Подиум ═══ */}
        {leaders.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 overflow-hidden">
            <SectionTitle>Лидеры</SectionTitle>
            <div className="flex items-end justify-center gap-2 mt-4 px-2">
              {/* 2-е место */}
              {leaders[1] && (
                <button onClick={() => setSelectedLeader(leaders[1].username)} className="flex flex-col items-center flex-1 transition active:scale-95 outline-none select-none">
                  <UserAvatar username={leaders[1].username} avatarUrl={leaders[1].avatarUrl} size="md" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] mt-1.5 truncate w-full text-center">{leaders[1].username}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{leaders[1].count} м.</span>
                  <div className="mt-1.5 w-full h-14 rounded-t-xl bg-gradient-to-t from-gray-400/20 to-gray-400/5 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400">2</span>
                  </div>
                </button>
              )}
              {/* 1-е место */}
              {leaders[0] && (
                <button onClick={() => setSelectedLeader(leaders[0].username)} className="flex flex-col items-center flex-1 transition active:scale-95 outline-none select-none -mt-4">
                  <Crown className="h-6 w-6 text-yellow-500 mb-1 animate-float" />
                  <div className="rounded-full ring-2 ring-yellow-500/40 p-0.5">
                    <UserAvatar username={leaders[0].username} avatarUrl={leaders[0].avatarUrl} size="lg" />
                  </div>
                  <span className="text-sm font-bold text-[var(--text-primary)] mt-1.5 truncate w-full text-center">{leaders[0].username}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{leaders[0].count} м.</span>
                  <div className="mt-1.5 w-full h-20 rounded-t-xl bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 flex items-center justify-center">
                    <span className="text-2xl font-black text-yellow-500">1</span>
                  </div>
                </button>
              )}
              {/* 3-е место */}
              {leaders[2] && (
                <button onClick={() => setSelectedLeader(leaders[2].username)} className="flex flex-col items-center flex-1 transition active:scale-95 outline-none select-none">
                  <UserAvatar username={leaders[2].username} avatarUrl={leaders[2].avatarUrl} size="md" />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] mt-1.5 truncate w-full text-center">{leaders[2].username}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{leaders[2].count} м.</span>
                  <div className="mt-1.5 w-full h-10 rounded-t-xl bg-gradient-to-t from-orange-400/20 to-orange-400/5 flex items-center justify-center">
                    <span className="text-lg font-black text-orange-400">3</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ ПОДДЕРЖКА ═══ */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-support-screen"))}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-teal-500/10 to-cyan-500/5 border border-teal-500/20 px-4 py-3 transition hover:from-teal-500/15 active:scale-[0.98] text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 shrink-0">
            <LifeBuoy className="h-5 w-5 text-teal-500" />
          </div>
          <span className="text-sm font-medium text-[var(--text-secondary)]">Нужна помощь? Напишите нам</span>
        </button>

        {/* ═══ ВОЗМОЖНОСТИ — сетка 2x3 ═══ */}
        <div>
          <SectionTitle>Возможности</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { icon: Footprints, title: "GPS-трекинг", desc: "Отслеживайте прогресс в реальном времени", color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
              { icon: Coins, title: "Монеты", desc: "Зарабатывайте за каждый маршрут", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
              { icon: Trophy, title: "Достижения", desc: "Более 15 наград и уровни", color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
              { icon: Users, title: "Друзья", desc: "Гуляйте вместе, дарите подарки", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
              { icon: Gem, title: "Магазин", desc: "Рамки, титулы, темы оформления", color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20" },
              { icon: MessageCircle, title: "Общение", desc: "Комментарии и личные сообщения", color: "text-teal-500", bg: "bg-teal-500/10", border: "border-teal-500/20" },
            ].map(({ icon: Ic, title, desc, color, bg, border }, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-2xl ${border} border bg-[var(--bg-surface)] p-3.5 animate-scale-in`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} shrink-0`}>
                  <Ic className={`h-4.5 w-4.5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-[var(--text-primary)] block leading-tight">{title}</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ ОТЗЫВЫ ═══ */}
        <ReviewsSection onWriteReview={() => window.dispatchEvent(new CustomEvent("open-reviews-screen"))} />

        {/* ═══ FOOTER ═══ */}
        <div className="text-center pt-3 pb-2">
          <p className="text-[11px] text-[var(--text-muted)]">
            Ростов GO · 2026
          </p>
          <button
            onClick={() => window.dispatchEvent(new Event("open-about-screen"))}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition underline underline-offset-2"
          >
            О приложении
          </button>
        </div>
      </div>

      {/* ═══ МОДАЛКИ ═══ */}
      {selectedAch && (
        <AchievementModal
          achievement={selectedAch}
          unlocked={unlockedSlugs.has(selectedAch.slug) || selectedAch.check(userStats)}
          userStats={userStats}
          onClose={() => setSelectedAch(null)}
        />
      )}

      {selectedLeader && (
        <LeaderModal username={selectedLeader} onClose={() => setSelectedLeader(null)} />
      )}

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
  );
}

// ─── Main ───────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading, authFetch } = useUser();
  const [publicStats, setPublicStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [weather, setWeather] = useState(null);
  const [routeOfDay, setRouteOfDay] = useState(null);
  const [featuredRoutes, setFeaturedRoutes] = useState([]);
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
      const allRoutes = Array.isArray(featured.routes) ? featured.routes : [];
      setFeaturedRoutes(allRoutes);
      if (featured.manual && featured.route) {
        setRouteOfDay(featured.route);
      } else if (allRoutes.length > 0) {
        const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        setRouteOfDay(allRoutes[day % allRoutes.length]);
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
    return <GuestView publicStats={publicStats} weather={weather} routeOfDay={routeOfDay} featuredRoutes={featuredRoutes} />;
  }

  return (
    <AuthenticatedView
      user={user}
      userStats={userStats || { completedRoutes: 0, totalDistanceM: 0, coins: 0, commentsCount: 0, hasNightCompletion: false, achievements: [] }}
      publicStats={publicStats}
      weather={weather}
      routeOfDay={routeOfDay}
      leaders={leaders}
      featuredRoutes={featuredRoutes}
    />
  );
}
