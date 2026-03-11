"use client";

import { useState } from "react";
import { Map, Users, Gem, Trophy, Star, Crown, LifeBuoy } from "lucide-react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES } from "@/lib/achievements";
import { formatDist, getGreeting, getUserLevel, getLevelProgress, getWeatherIcon, getWeatherTip, ICON_MAP } from "./helpers";
import SectionTitle from "./SectionTitle";
import FeaturedRoutesGallery from "./FeaturedRoutesGallery";
import FeaturesGrid from "./FeaturesGrid";
import ReviewsSection from "./ReviewsSection";
import TutorialRewardOverlay from "./TutorialRewardOverlay";
import AchievementModal from "./AchievementModal";
import LeaderModal from "./LeaderModal";
import LevelsModal from "./LevelsModal";

export default function AuthenticatedView({ user, userStats, publicStats, weather, routeOfDay, leaders, featuredRoutes }) {
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

      {/* HERO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600/90 via-emerald-500/85 to-teal-400/80 px-5 pt-10 pb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-full ring-2 ring-white/20 p-0.5">
                <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="lg" equippedItems={user.equippedItems} />
              </div>
              <button
                onClick={() => setLevelsOpen(true)}
                className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow-[var(--shadow-sm)] transition active:scale-[0.97] ${
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

          {progress.next && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-white/60 mb-1.5">
                <span>{level.title}</span>
                <span>{completedRoutes}/{progress.next.min} → {progress.next.title}</span>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all duration-1000" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="glass-widget rounded-xl px-2 py-2.5 text-center !border-white/15 !bg-white/10">
              <div className="text-xl font-black text-white leading-none">{userStats.completedRoutes}</div>
              <div className="text-xs text-white/60 mt-0.5">Маршрутов</div>
            </div>
            <div className="glass-widget rounded-xl px-2 py-2.5 text-center !border-white/15 !bg-white/10">
              <div className="text-xl font-black text-white leading-none">{dist.value}<span className="text-sm font-bold"> {dist.unit}</span></div>
              <div className="text-xs text-white/60 mt-0.5">Пройдено</div>
            </div>
            <div className="glass-widget rounded-xl px-2 py-2.5 text-center !border-white/15 !bg-white/10">
              <div className="text-xl font-black text-white leading-none">{userStats.coins}</div>
              <div className="text-xs text-white/60 mt-0.5">Монеты</div>
            </div>
          </div>

          {(user.routiks || 0) > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-white/70 text-xs">
              <span>🔷</span>
              <span className="font-bold text-white">{user.routiks}</span>
              <span>маршрутиков</span>
            </div>
          )}
        </div>
      </div>

      {/* Основной контент */}
      <div className="relative z-10 -mt-4 rounded-t-3xl bg-[var(--bg-main)] pt-5 px-4 space-y-4">
        {/* Bento: Погода + Маршрут дня */}
        {(weather || routeOfDay) && (
          <div className={`grid gap-3 ${weather && routeOfDay ? "grid-cols-5" : "grid-cols-1"}`}>
            {weather && WeatherIc && (
              <div className={`${routeOfDay ? "col-span-2" : ""} glass-widget p-3.5`}>
                <WeatherIc className={`h-8 w-8 ${weatherData.color} mb-1`} />
                <div className="text-2xl font-black text-[var(--text-primary)] leading-none">{Math.round(weather.temp)}°</div>
                <div className="text-xs text-[var(--text-muted)] mt-1 leading-tight">{weatherTip}</div>
              </div>
            )}
            {routeOfDay && (
              <Link
                href={`/routes/${routeOfDay._id}`}
                className={`${weather ? "col-span-3" : ""} glass-widget p-3.5 !bg-gradient-to-br !from-orange-500/10 !to-amber-500/5 !border-orange-500/20 transition hover:!from-orange-500/15 active:scale-[0.97]`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Star className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Маршрут дня</span>
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)] truncate">{routeOfDay.title}</div>
                <div className="flex gap-3 mt-1.5 text-xs text-[var(--text-muted)]">
                  {routeOfDay.distance > 0 && <span>{formatDist(routeOfDay.distance).value} {formatDist(routeOfDay.distance).unit}</span>}
                  {routeOfDay.duration > 0 && <span>{routeOfDay.duration} мин</span>}
                  {routeOfDay.checkpoints?.length > 0 && <span>{routeOfDay.checkpoints.length} точек</span>}
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Map, title: "Маршруты", gradient: "from-green-500 to-emerald-500", bg: "bg-green-500/10", href: "/routes" },
            { icon: Users, title: "Друзья", gradient: "from-blue-500 to-sky-500", bg: "bg-blue-500/10", href: "/friends" },
            { icon: Gem, title: "Магазин", gradient: "from-pink-500 to-rose-500", bg: "bg-pink-500/10", href: "/shop" },
            { icon: Trophy, title: "Профиль", gradient: "from-purple-500 to-violet-500", bg: "bg-purple-500/10", onClick: () => window.dispatchEvent(new Event("open-profile-modal")) },
          ].map(({ icon: Ic, title, gradient, bg, href, onClick }) => {
            const Tag = href ? Link : "button";
            const tagProps = href ? { href } : { onClick, type: "button" };
            return (
              <Tag key={title} {...tagProps} className={`flex flex-col items-center gap-1.5 glass-card ${bg} py-3 px-2`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
                  <Ic className="h-5.5 w-5.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{title}</span>
              </Tag>
            );
          })}
        </div>

        <FeaturedRoutesGallery routes={featuredRoutes} />

        {/* Achievements */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Достижения</SectionTitle>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {unlockedCount}<span className="text-[var(--text-muted)]">/{ACHIEVEMENT_REGISTRY.length}</span>
            </span>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {ACHIEVEMENT_REGISTRY.map((a) => {
              const ok = unlockedSlugs.has(a.slug) || a.check(userStats);
              const Ic = ICON_MAP[a.icon] || Trophy;
              const colors = COLOR_CLASSES[a.color] || COLOR_CLASSES.blue;
              return (
                <button key={a.slug} onClick={() => setSelectedAch(a)} className="shrink-0 flex flex-col items-center w-18 transition active:scale-90 select-none outline-none">
                  <div className={`h-13 w-13 rounded-full flex items-center justify-center ${ok ? colors.bg : "bg-[var(--bg-elevated)] opacity-40"}`}>
                    <Ic className={`h-5.5 w-5.5 ${ok ? colors.text : "text-[var(--text-muted)]"}`} />
                  </div>
                  <span className={`text-xs font-medium mt-1 text-center leading-tight line-clamp-2 ${ok ? colors.text : "text-[var(--text-muted)]"}`}>{a.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        {leaders.length > 0 && (
          <div className="glass-card p-4 overflow-hidden">
            <SectionTitle>Лидеры</SectionTitle>
            <div className="flex items-end justify-center gap-2 mt-4 px-2">
              {leaders[1] && (
                <button onClick={() => setSelectedLeader(leaders[1].username)} className="flex flex-col items-center flex-1 transition active:scale-95 outline-none select-none">
                  <UserAvatar username={leaders[1].username} avatarUrl={leaders[1].avatarUrl} size="md" />
                  <span className="text-xs font-bold text-[var(--text-primary)] mt-1.5 truncate w-full text-center">{leaders[1].username}</span>
                  <span className="text-xs text-[var(--text-muted)]">{leaders[1].count} м.</span>
                  <div className="mt-1.5 w-full h-14 rounded-t-xl bg-gradient-to-t from-gray-400/20 to-gray-400/5 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400">2</span>
                  </div>
                </button>
              )}
              {leaders[0] && (
                <button onClick={() => setSelectedLeader(leaders[0].username)} className="flex flex-col items-center flex-1 transition active:scale-95 outline-none select-none -mt-4">
                  <Crown className="h-6 w-6 text-yellow-500 mb-1" />
                  <div className="rounded-full ring-2 ring-yellow-500/40 p-0.5">
                    <UserAvatar username={leaders[0].username} avatarUrl={leaders[0].avatarUrl} size="lg" />
                  </div>
                  <span className="text-xs font-bold text-[var(--text-primary)] mt-1.5 truncate w-full text-center">{leaders[0].username}</span>
                  <span className="text-xs text-[var(--text-muted)]">{leaders[0].count} м.</span>
                  <div className="mt-1.5 w-full h-20 rounded-t-xl bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 border-t-2 border-yellow-500/40 flex items-center justify-center">
                    <span className="text-2xl font-black text-yellow-500">1</span>
                  </div>
                </button>
              )}
              {leaders[2] && (
                <button onClick={() => setSelectedLeader(leaders[2].username)} className="flex flex-col items-center flex-1 transition active:scale-95 outline-none select-none">
                  <UserAvatar username={leaders[2].username} avatarUrl={leaders[2].avatarUrl} size="md" />
                  <span className="text-xs font-bold text-[var(--text-primary)] mt-1.5 truncate w-full text-center">{leaders[2].username}</span>
                  <span className="text-xs text-[var(--text-muted)]">{leaders[2].count} м.</span>
                  <div className="mt-1.5 w-full h-10 rounded-t-xl bg-gradient-to-t from-orange-400/20 to-orange-400/5 flex items-center justify-center">
                    <span className="text-lg font-black text-orange-400">3</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Поддержка */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-support-screen"))}
          className="flex w-full items-center gap-3 glass-card !bg-gradient-to-r !from-teal-500/10 !to-cyan-500/5 !border-teal-500/20 px-4 py-3 text-left"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 shrink-0">
            <LifeBuoy className="h-5 w-5 text-teal-500" />
          </div>
          <span className="text-sm font-medium text-[var(--text-secondary)]">Нужна помощь? Напишите нам</span>
        </button>

        <FeaturesGrid />
        <ReviewsSection onWriteReview={() => window.dispatchEvent(new CustomEvent("open-reviews-screen"))} />

        {/* Footer */}
        <div className="text-center pt-3 pb-2">
          <p className="text-xs text-[var(--text-muted)]">Ростов GO · 2026</p>
          <button onClick={() => window.dispatchEvent(new Event("open-about-screen"))} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition underline underline-offset-2">
            О приложении
          </button>
        </div>
      </div>

      {/* Модалки */}
      {selectedAch && (
        <AchievementModal
          achievement={selectedAch}
          unlocked={unlockedSlugs.has(selectedAch.slug) || selectedAch.check(userStats)}
          userStats={userStats}
          onClose={() => setSelectedAch(null)}
        />
      )}
      {selectedLeader && <LeaderModal username={selectedLeader} onClose={() => setSelectedLeader(null)} />}
      {levelsOpen && <LevelsModal level={level} completedRoutes={completedRoutes} onClose={() => setLevelsOpen(false)} />}
    </div>
  );
}
