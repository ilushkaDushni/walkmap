"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Coins } from "lucide-react";

export default function TutorialRewardOverlay() {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(0);
  const [phase, setPhase] = useState("idle");

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

      <div className="absolute inset-0 bg-black/40" style={{ animation: "tr-bg 0.4s ease-out both" }} />

      <div className="relative flex flex-col items-center">
        {[0, 0.3, 0.6].map((d, i) => (
          <div key={i} className="absolute w-32 h-32 rounded-full border-2 border-yellow-400/30" style={{ animation: `tr-ring 1.5s ease-out ${d}s infinite` }} />
        ))}

        <div
          className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-[var(--shadow-xl)]"
          style={{ animation: "tr-coin-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.2s both" }}
        >
          <Coins size={44} className="text-white drop-shadow-lg" />
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

        <p className="mt-2 text-lg font-bold text-white/90" style={{ animation: "tr-text-up 0.5s ease-out 0.7s both" }}>
          Монет за обучение!
        </p>
        <p className="mt-1 text-sm text-white/50" style={{ animation: "tr-text-up 0.5s ease-out 0.9s both" }}>
          Добро пожаловать в Ростов GO
        </p>
      </div>
    </div>,
    document.body
  );
}
