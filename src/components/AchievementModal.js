"use client";

import { useEffect } from "react";
import { X, Coins } from "lucide-react";
import {
  Footprints, Compass, Ruler, Map, Trophy,
  Shield, Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
} from "lucide-react";
import { ACHIEVEMENT_MAP, COLOR_CLASSES } from "@/lib/achievements";

const ICON_MAP = {
  Footprints, Coins, Compass, Ruler, Map, Trophy,
  Shield, Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function AchievementModal({ slug, date, onClose }) {
  const achievement = ACHIEVEMENT_MAP[slug];

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!achievement) return null;

  const Icon = ICON_MAP[achievement.icon] || Trophy;
  const colors = COLOR_CLASSES[achievement.color] || COLOR_CLASSES.blue;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-xs rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon area */}
        <div className={`flex flex-col items-center pt-8 pb-4 ${colors.bg}`}>
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colors.bg} border-2 border-current ${colors.text}`}>
            <Icon className={`h-8 w-8 ${colors.text}`} />
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pb-6 pt-3 text-center">
          <h3 className={`text-lg font-bold ${colors.text}`}>{achievement.title}</h3>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{achievement.desc}</p>

          {achievement.flavor && (
            <>
              <div className="my-3 h-px bg-[var(--border-color)]" />
              <p className="text-xs italic text-[var(--text-muted)] leading-relaxed">
                &laquo;{achievement.flavor}&raquo;
              </p>
            </>
          )}

          {achievement.reward > 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1.5">
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-bold text-yellow-500">+{achievement.reward} монет</span>
            </div>
          )}

          {date && (
            <p className="mt-3 text-[11px] text-[var(--text-muted)]">
              Получено: {formatDate(date)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
