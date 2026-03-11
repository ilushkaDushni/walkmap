"use client";

import { useState, useEffect } from "react";
import { Coins, Trophy, X } from "lucide-react";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES } from "@/lib/achievements";
import { ICON_MAP } from "./helpers";

export default function AchievementModal({ achievement, unlocked, userStats, onClose }) {
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
        className={`relative w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-[var(--shadow-xl)] transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleClose} className="absolute top-3 right-3 p-1 rounded-lg hover:bg-[var(--bg-elevated)] transition">
          <X className="h-4 w-4 text-[var(--text-muted)]" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${unlocked ? colors.bg : "bg-[var(--bg-elevated)]"} mb-3 ${unlocked && prog.special ? "ring-2 ring-orange-400/60 shadow-[0_0_20px_rgba(251,146,60,0.4)]" : ""}`}>
            <Icon className={`h-8 w-8 ${unlocked ? colors.text : "text-[var(--text-muted)]"}`} />
          </div>

          <h3 className={`text-lg font-bold ${unlocked ? colors.text : "text-[var(--text-primary)]"}`}>
            {achievement.title}
          </h3>

          <p className="text-sm text-[var(--text-secondary)] mt-1">{achievement.desc}</p>

          {achievement.flavor && (
            <p className="text-xs text-[var(--text-muted)] italic mt-2">&laquo;{achievement.flavor}&raquo;</p>
          )}

          {!prog.special && (
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
          )}

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
