// ─── Реестр достижений ──────────────────────────────────────────
// Добавление нового достижения: добавить запись сюда — всё.
// check(stats) — разблокировано ли, progress(stats) — текущий / цель.

export const ACHIEVEMENT_REGISTRY = [
  // ── Маршруты ──
  {
    slug: "first_steps",
    title: "Первые шаги",
    desc: "Пройти 1 маршрут",
    flavor: "Путь в тысячу ли начинается с первого шага",
    icon: "Footprints",
    color: "blue",
    reward: 10,
    check: (s) => s.completedRoutes >= 1,
    progress: (s) => ({ current: s.completedRoutes, target: 1 }),
  },
  {
    slug: "traveler",
    title: "Путник",
    desc: "Пройти 5 маршрутов",
    flavor: "Город уже не кажется таким большим",
    icon: "Compass",
    color: "emerald",
    reward: 25,
    check: (s) => s.completedRoutes >= 5,
    progress: (s) => ({ current: s.completedRoutes, target: 5 }),
  },
  {
    slug: "expert",
    title: "Знаток",
    desc: "Пройти 10 маршрутов",
    flavor: "Вы знаете улицы лучше таксистов",
    icon: "Map",
    color: "purple",
    reward: 50,
    check: (s) => s.completedRoutes >= 10,
    progress: (s) => ({ current: s.completedRoutes, target: 10 }),
  },
  {
    slug: "veteran",
    title: "Ветеран",
    desc: "Пройти 20 маршрутов",
    flavor: "Ростов — ваша вторая квартира",
    icon: "Shield",
    color: "indigo",
    reward: 75,
    check: (s) => s.completedRoutes >= 20,
    progress: (s) => ({ current: s.completedRoutes, target: 20 }),
  },
  {
    slug: "legend",
    title: "Легенда",
    desc: "Пройти 50 маршрутов",
    flavor: "О вас слагают городские легенды",
    icon: "Crown",
    color: "amber",
    reward: 150,
    check: (s) => s.completedRoutes >= 50,
    progress: (s) => ({ current: s.completedRoutes, target: 50 }),
  },

  // ── Дистанция ──
  {
    slug: "marathoner",
    title: "Марафонец",
    desc: "Пройти 5 км",
    flavor: "Первые километры — самые трудные",
    icon: "Ruler",
    color: "orange",
    reward: 20,
    check: (s) => s.totalDistanceM >= 5000,
    progress: (s) => ({ current: Math.round(s.totalDistanceM / 100) / 10, target: 5, unit: "км" }),
  },
  {
    slug: "explorer",
    title: "Покоритель",
    desc: "Пройти 25 км",
    flavor: "Вы прошли больше, чем иные за год",
    icon: "Zap",
    color: "teal",
    reward: 50,
    check: (s) => s.totalDistanceM >= 25000,
    progress: (s) => ({ current: Math.round(s.totalDistanceM / 100) / 10, target: 25, unit: "км" }),
  },
  {
    slug: "iron_legs",
    title: "Стальные ноги",
    desc: "Пройти 50 км",
    flavor: "Ваши кроссовки просят пощады",
    icon: "Flame",
    color: "red",
    reward: 75,
    check: (s) => s.totalDistanceM >= 50000,
    progress: (s) => ({ current: Math.round(s.totalDistanceM / 100) / 10, target: 50, unit: "км" }),
  },
  {
    slug: "globe_trotter",
    title: "Вокруг света",
    desc: "Пройти 100 км",
    flavor: "Земля круглая, но вы проверите",
    icon: "Globe",
    color: "violet",
    reward: 150,
    check: (s) => s.totalDistanceM >= 100000,
    progress: (s) => ({ current: Math.round(s.totalDistanceM / 100) / 10, target: 100, unit: "км" }),
  },

  // ── Монеты ──
  {
    slug: "collector",
    title: "Коллекционер",
    desc: "Накопить 50 монет",
    flavor: "Неплохое начало для копилки",
    icon: "Coins",
    color: "yellow",
    reward: 15,
    check: (s) => s.coins >= 50,
    progress: (s) => ({ current: s.coins, target: 50 }),
  },
  {
    slug: "rich",
    title: "Богач",
    desc: "Накопить 500 монет",
    flavor: "Скрудж Макдак одобряет",
    icon: "Trophy",
    color: "rose",
    reward: 100,
    check: (s) => s.coins >= 500,
    progress: (s) => ({ current: s.coins, target: 500 }),
  },
  {
    slug: "tycoon",
    title: "Магнат",
    desc: "Накопить 1000 монет",
    flavor: "Деньги к деньгам",
    icon: "Gem",
    color: "pink",
    reward: 200,
    check: (s) => s.coins >= 1000,
    progress: (s) => ({ current: s.coins, target: 1000 }),
  },

  // ── Социальные ──
  {
    slug: "commentator",
    title: "Комментатор",
    desc: "Оставить 1 комментарий",
    flavor: "У вас есть что сказать миру",
    icon: "MessageCircle",
    color: "sky",
    reward: 10,
    check: (s) => (s.commentsCount || 0) >= 1,
    progress: (s) => ({ current: s.commentsCount || 0, target: 1 }),
  },
  {
    slug: "reviewer",
    title: "Критик",
    desc: "Оставить 10 комментариев",
    flavor: "Ваше мнение бесценно",
    icon: "Star",
    color: "cyan",
    reward: 50,
    check: (s) => (s.commentsCount || 0) >= 10,
    progress: (s) => ({ current: s.commentsCount || 0, target: 10 }),
  },

  // ── Особые ──
  {
    slug: "night_walker",
    title: "Полуночник",
    desc: "Завершить маршрут ночью (00:00–05:00)",
    flavor: "Город спит, а вы гуляете",
    icon: "Moon",
    color: "slate",
    reward: 30,
    check: (s) => s.hasNightCompletion === true,
    progress: (s) => ({ current: s.hasNightCompletion ? 1 : 0, target: 1 }),
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
  indigo:  { text: "text-indigo-500",  bg: "bg-indigo-500/10" },
  amber:   { text: "text-amber-500",   bg: "bg-amber-500/10" },
  teal:    { text: "text-teal-500",    bg: "bg-teal-500/10" },
  violet:  { text: "text-violet-500",  bg: "bg-violet-500/10" },
  rose:    { text: "text-rose-500",    bg: "bg-rose-500/10" },
  pink:    { text: "text-pink-500",    bg: "bg-pink-500/10" },
  sky:     { text: "text-sky-500",     bg: "bg-sky-500/10" },
  cyan:    { text: "text-cyan-500",    bg: "bg-cyan-500/10" },
  slate:   { text: "text-slate-400",   bg: "bg-slate-500/10" },
};

// Маппинг имени иконки → React-компонент (для клиента)
export const ICON_MAP_KEYS = [
  "Footprints", "Coins", "Compass", "Ruler", "Map", "Trophy",
  "Shield", "Crown", "Zap", "Flame", "Globe", "Gem",
  "MessageCircle", "Star", "Moon",
];
