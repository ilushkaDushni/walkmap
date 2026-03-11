import { Footprints, Coins, Trophy, Users, Gem, MessageCircle } from "lucide-react";
import SectionTitle from "./SectionTitle";

const FEATURES = [
  { icon: Footprints, title: "GPS-трекинг", desc: "Отслеживайте прогресс в реальном времени", color: "text-green-500", bg: "bg-green-500/10" },
  { icon: Coins, title: "Монеты", desc: "Зарабатывайте за каждый маршрут", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  { icon: Trophy, title: "Достижения", desc: "Более 15 наград и уровни", color: "text-purple-500", bg: "bg-purple-500/10" },
  { icon: Users, title: "Друзья", desc: "Гуляйте вместе, дарите подарки", color: "text-blue-500", bg: "bg-blue-500/10" },
  { icon: Gem, title: "Магазин", desc: "Рамки, титулы, темы оформления", color: "text-pink-500", bg: "bg-pink-500/10" },
  { icon: MessageCircle, title: "Общение", desc: "Комментарии и личные сообщения", color: "text-teal-500", bg: "bg-teal-500/10" },
];

export default function FeaturesGrid() {
  return (
    <div>
      <SectionTitle>Возможности</SectionTitle>
      <div className="grid grid-cols-2 gap-3 mt-2">
        {FEATURES.map(({ icon: Ic, title, desc, color, bg }, i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3.5 shadow-[var(--shadow-sm)]">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} shrink-0`}>
              <Ic className={`h-4.5 w-4.5 ${color}`} />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-[var(--text-primary)] block leading-tight">{title}</span>
              <span className="text-xs text-[var(--text-muted)] leading-tight">{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
