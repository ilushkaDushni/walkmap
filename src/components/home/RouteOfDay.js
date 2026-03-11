import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import { formatDist } from "./helpers";

export default function RouteOfDay({ route, onClick }) {
  if (!route) return null;
  const dist = formatDist(route.distance || 0);
  const Tag = onClick ? "button" : Link;
  const tagProps = onClick ? { onClick, type: "button" } : { href: `/routes/${route._id}` };
  return (
    <Tag
      {...tagProps}
      className="block w-full text-left rounded-2xl bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/20 p-4 transition hover:from-orange-500/20 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/20 shrink-0">
          <Star className="h-5 w-5 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-0.5">Маршрут дня</div>
          <div className="text-base font-bold text-[var(--text-primary)] truncate">{route.title}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-orange-400 shrink-0" />
      </div>
      <div className="flex gap-4 mt-2 ml-14 text-xs text-[var(--text-muted)]">
        {route.distance > 0 && <span>{dist.value} {dist.unit}</span>}
        {route.duration > 0 && <span>{route.duration} мин</span>}
        {route.checkpoints?.length > 0 && <span>{route.checkpoints.length} точек</span>}
      </div>
    </Tag>
  );
}
