"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Footprints, Coins, Compass, Ruler, Map, Trophy,
  Shield, Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
} from "lucide-react";
import { ACHIEVEMENT_MAP, COLOR_CLASSES } from "@/lib/achievements";

const ICON_MAP = {
  Footprints, Coins, Compass, Ruler, Map, Trophy,
  Shield, Crown, Zap, Flame, Globe, Gem, MessageCircle, Star, Moon,
};

/**
 * Глобальный тост для достижений.
 * Триггер: window.dispatchEvent(new CustomEvent("achievement-unlocked", { detail: { slugs, rewardCoins } }))
 */
export default function AchievementToast() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);

  const showNext = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) return q;
      const [next, ...rest] = q;
      setCurrent(next);
      setVisible(true);
      return rest;
    });
  }, []);

  // Слушаем событие
  useEffect(() => {
    function handler(e) {
      const { slugs = [], rewardCoins = 0 } = e.detail || {};
      if (slugs.length === 0) return;

      const items = slugs.map((slug) => {
        const def = ACHIEVEMENT_MAP[slug];
        return def ? { ...def, rewardCoins: def.reward } : null;
      }).filter(Boolean);

      if (items.length > 0) {
        setQueue((q) => [...q, ...items]);
      }
    }

    window.addEventListener("achievement-unlocked", handler);
    return () => window.removeEventListener("achievement-unlocked", handler);
  }, []);

  // Показываем следующий из очереди
  useEffect(() => {
    if (!current && queue.length > 0) showNext();
  }, [queue, current, showNext]);

  // Автоскрытие
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setCurrent(null), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [visible, current]);

  if (!current) return null;

  const Icon = ICON_MAP[current.icon] || Trophy;
  const colors = COLOR_CLASSES[current.color] || COLOR_CLASSES.blue;

  return (
    <div
      className={`fixed top-16 left-4 right-4 z-[100] mx-auto max-w-sm transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
      }`}
    >
      <div className={`flex items-center gap-3 rounded-2xl ${colors.bg} border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg} shrink-0`}>
          <Icon className={`h-5 w-5 ${colors.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Достижение!</div>
          <div className={`text-sm font-bold ${colors.text} truncate`}>{current.title}</div>
        </div>
        {current.rewardCoins > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <Coins className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-bold text-yellow-500">+{current.rewardCoins}</span>
          </div>
        )}
      </div>
    </div>
  );
}
