import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning } from "lucide-react";

export function formatDist(m) {
  if (m >= 1000) return { value: Math.round(m / 100) / 10, unit: "км" };
  return { value: m, unit: "м" };
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export const LEVELS = [
  { min: 0, title: "Начинающий", desc: "Вы только начали свой путь", color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-elevated)]" },
  { min: 1, title: "Новичок", desc: "Пройдите 1 маршрут", color: "text-green-500", bg: "bg-green-500/10" },
  { min: 5, title: "Путешественник", desc: "Пройдите 5 маршрутов", color: "text-blue-500", bg: "bg-blue-500/10" },
  { min: 10, title: "Исследователь", desc: "Пройдите 10 маршрутов", color: "text-purple-500", bg: "bg-purple-500/10" },
  { min: 20, title: "Легенда", desc: "Пройдите 20 маршрутов", color: "text-yellow-500", bg: "bg-yellow-500/10" },
];

export function getUserLevel(c) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) { if (c >= l.min) lvl = l; }
  return lvl;
}

export function getLevelProgress(c) {
  const idx = LEVELS.findIndex((l) => c < l.min);
  if (idx === -1) return { pct: 100, next: null };
  const prev = LEVELS[idx - 1]?.min || 0;
  return { pct: Math.round(((c - prev) / (LEVELS[idx].min - prev)) * 100), next: LEVELS[idx] };
}

export function calcOnlineCount(totalUsers) {
  const total = totalUsers || 0;
  if (total === 0) return 0;
  const hour = new Date().getHours();
  const mult =
    hour >= 10 && hour <= 20 ? 0.15 + 0.1 * Math.sin(((hour - 10) / 10) * Math.PI)
    : hour >= 7 && hour < 10 ? 0.08
    : hour >= 21 && hour <= 23 ? 0.07
    : 0.03;
  const seed = Math.floor(Date.now() / 60000);
  const rng = ((seed * 9301 + 49297) % 233280) / 233280;
  const raw = total * mult + rng * Math.min(total * 0.1, 3);
  return Math.min(total, Math.max(1, Math.round(raw)));
}

export function getWeatherIcon(code) {
  if (code <= 1) return { Icon: Sun, color: "text-yellow-400", gradient: "from-yellow-500/20 to-orange-500/10" };
  if (code <= 3) return { Icon: Cloud, color: "text-blue-400", gradient: "from-blue-500/15 to-sky-500/10" };
  if (code <= 48) return { Icon: Cloud, color: "text-gray-400", gradient: "from-gray-500/15 to-slate-500/10" };
  if (code <= 67) return { Icon: CloudRain, color: "text-blue-500", gradient: "from-blue-500/20 to-indigo-500/10" };
  if (code <= 86) return { Icon: CloudSnow, color: "text-sky-300", gradient: "from-sky-500/15 to-blue-500/10" };
  return { Icon: CloudLightning, color: "text-purple-500", gradient: "from-purple-500/20 to-violet-500/10" };
}

export function getWeatherTip(code, temp) {
  if (code >= 95) return "Лучше остаться дома";
  if (code >= 61 && code <= 67) return "Возьмите зонт!";
  if (code >= 71) return "Оденьтесь теплее";
  if (temp > 25) return "Возьмите воду!";
  if (temp > 15) return "Идеально для прогулки!";
  if (temp > 5) return "Одевайтесь теплее";
  return "Холодно, но гулять можно";
}

export const ICON_MAP = {
  Footprints: require("lucide-react").Footprints,
  Coins: require("lucide-react").Coins,
  Compass: require("lucide-react").Compass,
  Ruler: require("lucide-react").Ruler,
  Map: require("lucide-react").Map,
  Trophy: require("lucide-react").Trophy,
  Shield: require("lucide-react").Shield,
  Crown: require("lucide-react").Crown,
  Zap: require("lucide-react").Zap,
  Flame: require("lucide-react").Flame,
  Globe: require("lucide-react").Globe,
  Gem: require("lucide-react").Gem,
  MessageCircle: require("lucide-react").MessageCircle,
  Star: require("lucide-react").Star,
  Moon: require("lucide-react").Moon,
};
