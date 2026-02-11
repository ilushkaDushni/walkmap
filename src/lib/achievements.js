// ─── Реестр достижений ──────────────────────────────────────────
// Добавление нового достижения: добавить запись сюда — всё.
// check(stats) — разблокировано ли, progress(stats) — текущий / цель.

export const ACHIEVEMENT_REGISTRY = [
  {
    slug: "first_steps",
    title: "Первые шаги",
    desc: "Пройти 1 маршрут",
    icon: "Footprints",
    color: "blue",
    reward: 10,
    check: (s) => s.completedRoutes >= 1,
    progress: (s) => ({ current: s.completedRoutes, target: 1 }),
  },
  {
    slug: "collector",
    title: "Коллекционер",
    desc: "Накопить 50 монет",
    icon: "Coins",
    color: "yellow",
    reward: 15,
    check: (s) => s.coins >= 50,
    progress: (s) => ({ current: s.coins, target: 50 }),
  },
  {
    slug: "traveler",
    title: "Путник",
    desc: "Пройти 5 маршрутов",
    icon: "Compass",
    color: "emerald",
    reward: 25,
    check: (s) => s.completedRoutes >= 5,
    progress: (s) => ({ current: s.completedRoutes, target: 5 }),
  },
  {
    slug: "marathoner",
    title: "Марафонец",
    desc: "Пройти 5 км",
    icon: "Ruler",
    color: "orange",
    reward: 20,
    check: (s) => s.totalDistanceM >= 5000,
    progress: (s) => ({ current: Math.round(s.totalDistanceM / 100) / 10, target: 5, unit: "км" }),
  },
  {
    slug: "expert",
    title: "Знаток",
    desc: "Пройти 10 маршрутов",
    icon: "Map",
    color: "purple",
    reward: 50,
    check: (s) => s.completedRoutes >= 10,
    progress: (s) => ({ current: s.completedRoutes, target: 10 }),
  },
  {
    slug: "rich",
    title: "Богач",
    desc: "Накопить 500 монет",
    icon: "Trophy",
    color: "red",
    reward: 100,
    check: (s) => s.coins >= 500,
    progress: (s) => ({ current: s.coins, target: 500 }),
  },
];

// slug → определение
export const ACHIEVEMENT_MAP = Object.fromEntries(
  ACHIEVEMENT_REGISTRY.map((a) => [a.slug, a])
);

// Tailwind классы по цвету
export const COLOR_CLASSES = {
  blue:    { text: "text-blue-500",    bg: "bg-blue-500/10" },
  yellow:  { text: "text-yellow-500",  bg: "bg-yellow-500/10" },
  emerald: { text: "text-emerald-500", bg: "bg-emerald-500/10" },
  orange:  { text: "text-orange-500",  bg: "bg-orange-500/10" },
  purple:  { text: "text-purple-500",  bg: "bg-purple-500/10" },
  red:     { text: "text-red-500",     bg: "bg-red-500/10" },
};

// Маппинг имени иконки → React-компонент (для клиента)
export const ICON_MAP_KEYS = ["Footprints", "Coins", "Compass", "Ruler", "Map", "Trophy"];
