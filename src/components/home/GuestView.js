"use client";

import { MapPin, Route, ArrowRight, Map, Compass, Trophy, Zap, Shield } from "lucide-react";
import useInView from "./useInView";
import { formatDist } from "./helpers";
import { StatCard, OnlineStatCard } from "./StatCards";
import SectionTitle from "./SectionTitle";
import WeatherWidget from "./WeatherWidget";
import OnlineCounter from "./OnlineCounter";
import RouteOfDay from "./RouteOfDay";
import FeaturedRoutesGallery from "./FeaturedRoutesGallery";
import FeaturesGrid from "./FeaturesGrid";
import ReviewsSection from "./ReviewsSection";

export default function GuestView({ publicStats, weather, routeOfDay, featuredRoutes }) {
  const [heroRef, heroInView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [stepsRef, stepsInView] = useInView();
  const [featRef, featInView] = useInView();
  const [routesRef, routesInView] = useInView();
  const [ctaRef, ctaInView] = useInView();
  const dist = formatDist(publicStats.totalDistanceM);

  return (
    <div className="pb-4 space-y-5">
      {/* ГЕРОЙ */}
      <div ref={heroRef} className={`relative overflow-hidden bg-gradient-to-br from-emerald-600/90 via-emerald-500/85 to-teal-400/80 px-6 pt-12 pb-8 text-center ${heroInView ? "animate-slide-up" : "opacity-0"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md shadow-[var(--shadow-lg)]">
            <MapPin className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">Ростов GO</h1>
          <p className="mt-2 text-base text-white/80 font-medium">Больше, чем просто прогулка</p>
          <div className="flex justify-center mt-5">
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5">
              <Route className="h-3.5 w-3.5 text-white/80" />
              <span className="text-xs font-bold text-white">{publicStats.totalRoutes} маршрутов</span>
            </div>
          </div>
        </div>
      </div>

      <OnlineCounter totalUsers={publicStats.totalUsers} />

      <div className="px-4 space-y-5">
        <div ref={statsRef} className={`grid grid-cols-3 gap-3 ${statsInView ? "animate-slide-up" : "opacity-0"}`}>
          <StatCard icon={Route} value={publicStats.totalRoutes} label="Маршрутов" iconColor="text-green-500" inView={statsInView} />
          <StatCard icon={require("lucide-react").Ruler} value={dist.value} label={dist.unit} iconColor="text-blue-500" inView={statsInView} />
          <OnlineStatCard inView={statsInView} totalUsers={publicStats.totalUsers} />
        </div>

        <WeatherWidget weather={weather} />

        <div ref={stepsRef} className={`${stepsInView ? "animate-slide-up" : "opacity-0"}`}>
          <SectionTitle>Как это работает</SectionTitle>
          <div className="grid grid-cols-3 gap-2.5 mt-3">
            {[
              { num: "1", icon: Map, title: "Выберите", desc: "маршрут", color: "bg-[var(--accent-color)]" },
              { num: "2", icon: Compass, title: "Следуйте", desc: "чекпоинтам", color: "bg-blue-500" },
              { num: "3", icon: Trophy, title: "Получите", desc: "награды", color: "bg-yellow-500" },
            ].map(({ num, icon: Ic, title, desc, color }, i) => (
              <div key={i} className="flex flex-col items-center text-center glass-card p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color} text-white text-sm font-black mb-2`}>{num}</div>
                <Ic className="h-5 w-5 text-[var(--text-secondary)] mb-1" />
                <span className="text-xs font-bold text-[var(--text-primary)] leading-tight">{title}</span>
                <span className="text-xs text-[var(--text-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div ref={featRef} className={`${featInView ? "animate-slide-up" : "opacity-0"}`}>
          <FeaturesGrid />
        </div>

        <ReviewsSection onWriteReview={() => window.dispatchEvent(new Event("open-profile-modal"))} />
        <RouteOfDay route={routeOfDay} onClick={() => window.dispatchEvent(new Event("open-profile-modal"))} />

        <div ref={routesRef} className={`${routesInView ? "animate-slide-up" : "opacity-0"}`}>
          <FeaturedRoutesGallery routes={featuredRoutes} asGuest />
        </div>

        {/* CTA */}
        <div ref={ctaRef} className={`space-y-4 ${ctaInView ? "animate-slide-up" : "opacity-0"}`}>
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex -space-x-2">
              {["from-green-400 to-emerald-500", "from-blue-400 to-sky-500", "from-purple-400 to-violet-500", "from-orange-400 to-amber-500", "from-pink-400 to-rose-500"].map((g, i) => (
                <div key={i} className={`h-9 w-9 rounded-full border-2 border-[var(--bg-main)] bg-gradient-to-br ${g} flex items-center justify-center`}>
                  <span className="text-xs text-white/80 font-bold">{["А", "Д", "И", "М", "К"][i]}</span>
                </div>
              ))}
              <div className="h-9 w-9 rounded-full border-2 border-[var(--bg-main)] bg-[var(--bg-elevated)] flex items-center justify-center">
                <span className="text-xs text-[var(--text-muted)] font-bold">+{Math.max(0, (publicStats.totalUsers || 5) - 5)}</span>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] text-center">
              Присоединяйтесь к <span className="font-bold text-[var(--text-primary)]">{publicStats.totalUsers || 0}+</span> пользователям
            </p>
          </div>

          <button
            onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
            className="w-full flex items-center justify-center gap-2 btn-accent px-6 py-3.5 text-base font-bold transition"
          >
            Начать бесплатно
            <ArrowRight className="h-5 w-5" />
          </button>

          <div className="flex justify-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Бесплатно</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Без рекламы</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Оффлайн</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-3 pb-2">
          <p className="text-xs text-[var(--text-muted)]">Ростов GO · 2026</p>
          <button onClick={() => window.dispatchEvent(new Event("open-about-screen"))} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition underline underline-offset-2">
            О приложении
          </button>
        </div>
      </div>
    </div>
  );
}
