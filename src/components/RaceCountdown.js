"use client";

import { useState, useEffect } from "react";

/**
 * Оверлей с обратным отсчётом 3-2-1-GO!
 * Props: startedAt (Date/string), onComplete
 */
export default function RaceCountdown({ startedAt, onComplete }) {
  const [display, setDisplay] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!startedAt) return;

    const targetTime = new Date(startedAt).getTime();

    const tick = () => {
      const remaining = Math.ceil((targetTime - Date.now()) / 1000);

      if (remaining > 3) {
        setDisplay(null);
      } else if (remaining === 3) {
        setDisplay("3");
      } else if (remaining === 2) {
        setDisplay("2");
      } else if (remaining === 1) {
        setDisplay("1");
      } else if (remaining <= 0 && !done) {
        setDisplay("GO!");
        setDone(true);
        setTimeout(() => {
          onComplete?.();
        }, 800);
        return;
      }
    };

    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [startedAt, done, onComplete]);

  if (!display) return null;

  const isGo = display === "GO!";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        key={display}
        className="text-center"
        style={{
          animation: "race-countdown 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <span
          className={`block font-black ${
            isGo
              ? "text-7xl text-green-400"
              : "text-8xl text-white"
          }`}
          style={{ textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
        >
          {display}
        </span>
      </div>
      <style jsx global>{`
        @keyframes race-countdown {
          0% { transform: scale(2); opacity: 0; }
          50% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
