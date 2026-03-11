"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  MapPin,
  ShoppingBag,
  Users,
  Bell,
  Trophy,
  Sparkles,
  Coins,
  Shield,
  LifeBuoy,
  Hand,
} from "lucide-react";
import { useUser } from "./UserProvider";

const STEPS = [
  {
    id: "welcome",
    title: "Добро пожаловать!",
    desc: "Давайте быстро познакомимся с приложением. Это займёт меньше минуты.",
    icon: Sparkles,
    iconGradient: "from-violet-500 to-purple-600",
    route: "/",
  },
  {
    id: "routes",
    title: "Маршруты",
    desc: "Выбирайте прогулочные маршруты по Ростову. Следуйте по GPS и зарабатывайте монеты!",
    icon: MapPin,
    iconGradient: "from-rose-500 to-pink-600",
    target: '[data-tutorial="nav-routes"]',
    route: "/routes",
    hint: "Нажмите сюда, чтобы открыть маршруты",
  },
  {
    id: "shop",
    title: "Магазин",
    desc: "Тратьте монеты на рамки аватара, темы оформления и другие предметы.",
    icon: ShoppingBag,
    iconGradient: "from-blue-500 to-indigo-600",
    target: '[data-tutorial="nav-shop"]',
    route: "/shop",
    hint: "Здесь вход в магазин",
  },
  {
    id: "friends",
    title: "Друзья",
    desc: "Находите друзей, общайтесь в чате, дарите монеты и гуляйте вместе.",
    icon: Users,
    iconGradient: "from-emerald-500 to-green-600",
    target: '[data-tutorial="nav-friends"]',
    route: "/friends",
    hint: "Друзья и чат — тут",
  },
  {
    id: "rules",
    title: "Правила сообщества",
    desc: "Ознакомьтесь с правилами — они помогут сделать прогулки приятными для всех.",
    icon: Shield,
    iconGradient: "from-amber-500 to-orange-600",
    route: "/rules",
  },
  {
    id: "support",
    title: "Поддержка",
    desc: "Если возникнут вопросы — откройте Профиль → Поддержка. Мы всегда на связи!",
    icon: LifeBuoy,
    iconGradient: "from-teal-500 to-cyan-600",
    target: '[data-tutorial="nav-profile"]',
    route: "/",
    hint: "Поддержка — в профиле",
  },
  {
    id: "notifications",
    title: "Уведомления",
    desc: "Колокольчик покажет новые события — друзья, достижения, награды.",
    icon: Bell,
    iconGradient: "from-yellow-500 to-amber-600",
    target: '[data-tutorial="notifications"]',
    route: "/",
    hint: "Ваши уведомления",
  },
  {
    id: "finish",
    title: "Обучение пройдено!",
    icon: Trophy,
    iconGradient: "from-yellow-400 to-amber-500",
    isReward: true,
  },
];

const STORAGE_KEY = "tutorial_completed";

/* ─── Coin Particle ─── */
function CoinParticle({ index, total }) {
  const angle = (index / total) * Math.PI * 2;
  const r = 55 + Math.random() * 45;
  const d = index * 0.07;
  const dur = 0.7 + Math.random() * 0.5;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: "50%", top: "50%",
        animation: `tut-coin ${dur}s ease-out ${d}s both`,
        "--tx": `${Math.cos(angle) * r}px`,
        "--ty": `${Math.sin(angle) * r}px`,
      }}
    >
      <Coins size={14} className="text-yellow-400 drop-shadow-md" />
    </div>
  );
}

/* ─── Floating particles background ─── */
function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      dur: 3 + Math.random() * 4,
      delay: Math.random() * 3,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-white/10"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animation: `tut-float ${p.dur}s ease-in-out ${p.delay}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main ─── */
export default function TutorialOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authFetch, updateUser } = useUser();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | entering | visible | leaving
  const [rewardState, setRewardState] = useState("idle");
  const [rewardAmount, setRewardAmount] = useState(0);
  const [showCoins, setShowCoins] = useState(false);
  const rewardCalledRef = useRef(false);

  const cur = STEPS[step];
  const total = STEPS.length;

  /* ── Reward API ── */
  const claimReward = useCallback(async () => {
    if (rewardCalledRef.current || !authFetch) return;
    rewardCalledRef.current = true;
    setRewardState("claiming");
    try {
      const res = await authFetch("/api/tutorial/complete", { method: "POST" });
      const data = await res.json();
      if (data.rewarded) {
        setRewardAmount(data.reward);
        setRewardState("claimed");
        setShowCoins(true);
        updateUser({ coins: data.coins });
      } else {
        setRewardState("already");
      }
    } catch {
      setRewardState("already");
    }
  }, [authFetch, updateUser]);

  /* ── Start ── */
  const startTutorial = useCallback(() => {
    setStep(0);
    setTargetRect(null);
    setRewardState("idle");
    setRewardAmount(0);
    setShowCoins(false);
    rewardCalledRef.current = false;
    setActive(true);
    setPhase("entering");
    document.body.style.overflow = "hidden";
    setTimeout(() => setPhase("visible"), 50);
  }, []);

  /* ── End ── */
  const endTutorial = useCallback(() => {
    const reward = rewardState === "claimed" ? rewardAmount : 0;
    setPhase("leaving");
    setTimeout(() => {
      setActive(false);
      setStep(0);
      setTargetRect(null);
      setPhase("idle");
      document.body.style.overflow = "";
      localStorage.setItem(STORAGE_KEY, "true");
      if (window.location.pathname !== "/") router.push("/");
      if (reward > 0) {
        setTimeout(() => window.dispatchEvent(new CustomEvent("tutorial-reward", { detail: { amount: reward } })), 400);
      }
    }, 300);
  }, [router, rewardState, rewardAmount]);

  /* ── Events ── */
  useEffect(() => {
    const h1 = () => startTutorial();
    const h2 = () => { if (!localStorage.getItem(STORAGE_KEY)) setTimeout(startTutorial, 800); };
    window.addEventListener("start-tutorial", h1);
    window.addEventListener("tutorial-new-user", h2);
    return () => { window.removeEventListener("start-tutorial", h1); window.removeEventListener("tutorial-new-user", h2); };
  }, [startTutorial]);

  /* ── Navigate on step change ── */
  useEffect(() => {
    if (!active || phase !== "visible") return;
    const s = STEPS[step];
    if (s.route && pathname !== s.route) {
      document.body.style.overflow = "";
      router.push(s.route);
      setTimeout(() => { document.body.style.overflow = "hidden"; }, 400);
    }
  }, [active, step, pathname, router, phase]);

  /* ── Claim reward ── */
  useEffect(() => {
    if (active && cur?.isReward && user) claimReward();
  }, [active, step, user, claimReward, cur?.isReward]);

  /* ── Measure target ── */
  const measureTarget = useCallback(() => {
    if (!active) return;
    const s = STEPS[step];
    if (!s?.target) { setTargetRect(null); return; }
    const el = document.querySelector(s.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const pad = 10;
      setTargetRect({ x: r.x - pad, y: r.y - pad, w: r.width + pad * 2, h: r.height + pad * 2, cx: r.x + r.width / 2, cy: r.y + r.height / 2 });
    } else {
      setTargetRect(null);
    }
  }, [active, step]);

  useEffect(() => {
    measureTarget();
    const t1 = setTimeout(measureTarget, 300);
    const t2 = setTimeout(measureTarget, 600);
    const onResize = () => measureTarget();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
  }, [measureTarget]);

  /* ── Step Navigation ── */
  const goTo = useCallback((dir) => {
    if (phase !== "visible") return;
    const next = step + dir;
    if (next < 0) return;
    if (next >= total) { endTutorial(); return; }
    setPhase("leaving");
    setTimeout(() => {
      setStep(next);
      setPhase("entering");
      setTimeout(() => setPhase("visible"), 50);
    }, 250);
  }, [step, total, endTutorial, phase]);

  const goNext = useCallback(() => goTo(1), [goTo]);
  const goBack = useCallback(() => goTo(-1), [goTo]);

  /* ── Keyboard ── */
  useEffect(() => {
    if (!active) return;
    const h = (e) => {
      if (e.key === "ArrowRight" || e.key === "Enter") goNext();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "Escape") endTutorial();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, goNext, goBack, endTutorial]);

  if (!active) return null;

  const hasTarget = cur.target && targetRect;
  const Icon = cur.icon;
  const isFinish = cur.isReward;
  const isVisible = phase === "visible";
  const isLeaving = phase === "leaving";

  /* ── Tooltip position ── */
  const getTooltipStyle = () => {
    if (hasTarget) {
      const vw = window.innerWidth;
      const tw = Math.min(320, vw - 32);
      const pad = 16;
      const above = targetRect.cy > window.innerHeight * 0.5;
      const left = Math.max(pad, Math.min(targetRect.cx - tw / 2, vw - tw - pad));
      if (above) return { position: "fixed", bottom: `${window.innerHeight - targetRect.y + 16}px`, left: `${left}px`, width: `${tw}px` };
      return { position: "fixed", top: `${targetRect.y + targetRect.h + 16}px`, left: `${left}px`, width: `${tw}px` };
    }
    return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(360px, calc(100vw - 40px))" };
  };

  /* ── Arrow pointer from tooltip to target ── */
  const renderArrow = () => {
    if (!hasTarget) return null;
    const above = targetRect.cy > window.innerHeight * 0.5;
    return (
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ [above ? "bottom" : "top"]: "-20px" }}
      >
        <div
          className="w-4 h-4 rotate-45 bg-[var(--bg-surface)] border-[var(--border-color)]"
          style={{
            borderWidth: above ? "0 1px 1px 0" : "1px 0 0 1px",
          }}
        />
      </div>
    );
  };

  /* ── Reward content ── */
  const renderReward = () => (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-6 shadow-[var(--shadow-lg)] text-center overflow-hidden relative">
      <div className="relative w-28 h-28 mx-auto mb-5">
        <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(234,179,8,0.25) 0%, transparent 70%)", animation: "tut-glow 2s ease-in-out infinite" }} />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-[var(--shadow-sm)] shadow-amber-500/30" style={{ animation: "tut-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          <Trophy size={40} className="text-white drop-shadow-lg" />
        </div>
        {showCoins && Array.from({ length: 14 }).map((_, i) => <CoinParticle key={i} index={i} total={14} />)}
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2" style={{ animation: "tut-rise 0.4s ease-out 0.3s both" }}>
        Обучение пройдено!
      </h3>
      {rewardState === "claimed" && (
        <div style={{ animation: "tut-rise 0.4s ease-out 0.5s both" }}>
          <p className="text-sm text-[var(--text-secondary)] mb-3">Ваша награда:</p>
          <div className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border border-yellow-500/30" style={{ animation: "tut-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.7s both" }}>
            <Coins size={24} className="text-yellow-500" />
            <span className="text-3xl font-black text-yellow-500">+{rewardAmount}</span>
          </div>
        </div>
      )}
      {rewardState === "already" && (
        <p className="text-sm text-[var(--text-secondary)] mb-2" style={{ animation: "tut-rise 0.4s ease-out 0.5s both" }}>
          Выбирайте маршрут и отправляйтесь на прогулку!
        </p>
      )}
      {rewardState === "claiming" && (
        <div className="flex justify-center py-3">
          <div className="h-6 w-6 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
        </div>
      )}
      <button onClick={endTutorial} className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-[var(--shadow-sm)] shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all" style={{ animation: "tut-rise 0.4s ease-out 0.9s both" }}>
        <Sparkles size={18} />
        Начать!
      </button>
    </div>
  );

  /* ── Step counter ── */
  const stepNum = step + 1;
  const progress = ((step) / (total - 1)) * 100;

  return (
    <div className={`fixed inset-0 z-[200] transition-opacity duration-300 ${isVisible ? "opacity-100" : isLeaving ? "opacity-0" : "opacity-0"}`}>
      {/* Styles */}
      <style>{`
        @keyframes tut-pop { 0%{transform:scale(0) rotate(-15deg);opacity:0} 100%{transform:scale(1) rotate(0);opacity:1} }
        @keyframes tut-glow { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.4);opacity:1} }
        @keyframes tut-rise { 0%{transform:translateY(12px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @keyframes tut-bounce { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        @keyframes tut-coin { 0%{transform:translate(-50%,-50%) scale(0);opacity:1} 50%{opacity:1} 100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(.8);opacity:0} }
        @keyframes tut-float { 0%{transform:translateY(0) scale(1);opacity:.15} 100%{transform:translateY(-30px) scale(1.5);opacity:.05} }
        @keyframes tut-pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.5),0 0 20px 0 rgba(74,222,128,.15)} 50%{box-shadow:0 0 0 6px rgba(74,222,128,0),0 0 30px 5px rgba(74,222,128,.2)} }
        @keyframes tut-hand { 0%,100%{transform:translate(0,0)} 50%{transform:translate(0,6px)} }
        @keyframes tut-card-in { 0%{transform:translateY(20px) scale(.96);opacity:0} 100%{transform:translateY(0) scale(1);opacity:1} }
        @keyframes tut-card-in-center { 0%{transform:scale(.9);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>

      <FloatingParticles />

      {/* Overlay — soft dim with spotlight */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="tut-mask">
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={targetRect.x} y={targetRect.y}
                width={targetRect.w} height={targetRect.h}
                rx={20} fill="black"
                style={{ transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)" }}
              />
            )}
          </mask>
          {hasTarget && (
            <radialGradient id="tut-spot" cx={targetRect.cx / window.innerWidth} cy={targetRect.cy / window.innerHeight}>
              <stop offset="0%" stopColor="black" stopOpacity="0" />
              <stop offset="35%" stopColor="black" stopOpacity="0.25" />
              <stop offset="100%" stopColor="black" stopOpacity="0.45" />
            </radialGradient>
          )}
        </defs>
        {hasTarget ? (
          /* With target — radial gradient fading from spotlight */
          <>
            <rect width="100%" height="100%" fill="url(#tut-spot)" />
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.35)" mask="url(#tut-mask)" />
          </>
        ) : (
          /* No target — uniform soft dim */
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" />
        )}
      </svg>

      {/* Spotlight glow ring */}
      {hasTarget && (
        <div
          className="absolute rounded-[20px] pointer-events-none border-2 border-green-400/50"
          style={{
            left: targetRect.x, top: targetRect.y,
            width: targetRect.w, height: targetRect.h,
            transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
            animation: "tut-pulse-ring 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Hand pointer near target */}
      {hasTarget && cur.hint && (
        <div
          className="absolute z-[202] pointer-events-none flex items-center gap-1.5"
          style={{
            left: targetRect.x + targetRect.w / 2 - 12,
            top: targetRect.y - 36,
            transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
            animation: "tut-hand 1.2s ease-in-out infinite",
          }}
        >
          <Hand size={24} className="text-white drop-shadow-lg rotate-[20deg]" />
        </div>
      )}

      {/* Skip button */}
      {!isFinish && (
        <button
          onClick={endTutorial}
          className="absolute top-4 right-4 z-[203] flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white/80 hover:text-white text-xs font-medium transition-all bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10"
        >
          Пропустить
          <X size={12} />
        </button>
      )}

      {/* Step counter */}
      {!isFinish && (
        <div className="absolute top-4 left-4 z-[203] flex items-center gap-2">
          <span className="text-xs font-semibold text-white/80 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {stepNum} / {total - 1}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {!isFinish && (
        <div className="absolute top-14 left-4 right-4 z-[203] h-1 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Tooltip card */}
      <div
        style={getTooltipStyle()}
        className="z-[202]"
      >
        <div
          key={step}
          style={{
            animation: hasTarget
              ? "tut-card-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both"
              : "tut-card-in-center 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {isFinish ? renderReward() : (
            <div className="relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl p-5 shadow-[var(--shadow-lg)] shadow-black/20">
              {renderArrow()}

              {/* Icon + Title */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cur.iconGradient} flex items-center justify-center flex-shrink-0 shadow-[var(--shadow-sm)]`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                    {cur.title}
                  </h3>
                  {cur.hint && (
                    <span className="text-xs text-[var(--text-muted)]">{cur.hint}</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                {cur.desc}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between">
                {/* Mini dots */}
                <div className="flex gap-1">
                  {STEPS.slice(0, -1).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-500 ${
                        i === step
                          ? "w-5 h-2 bg-gradient-to-r from-green-400 to-emerald-500"
                          : i < step
                            ? "w-2 h-2 bg-green-500/40"
                            : "w-2 h-2 bg-[var(--border-color)]"
                      }`}
                    />
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  {step > 0 && (
                    <button
                      onClick={goBack}
                      className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all hover:scale-105 active:scale-95"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    className="flex items-center gap-1 px-5 h-10 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold shadow-[var(--shadow-sm)] shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Далее
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
