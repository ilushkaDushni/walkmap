import Link from "next/link";
import { MapPin } from "lucide-react";
import SectionTitle from "./SectionTitle";
import { formatDist } from "./helpers";

const ROUTE_COLORS = ["border-green-500/20", "border-blue-500/20", "border-purple-500/20", "border-orange-500/20"];
const ROUTE_ICONS = ["text-green-500", "text-blue-500", "text-purple-500", "text-orange-500"];

export default function FeaturedRoutesGallery({ routes, asGuest }) {
  if (!routes || routes.length === 0) return null;
  return (
    <div>
      <SectionTitle>Рекомендуемые</SectionTitle>
      <div className="flex gap-3 overflow-x-auto scrollbar-none mt-2 -mx-4 px-4 pb-1">
        {routes.map((route, i) => {
          const dist = formatDist(route.distance || 0);
          const Tag = asGuest ? "button" : Link;
          const tagProps = asGuest
            ? { onClick: () => window.dispatchEvent(new Event("open-profile-modal")), type: "button" }
            : { href: `/routes/${route._id}` };
          return (
            <Tag
              key={route._id}
              {...tagProps}
              className={`shrink-0 w-52 rounded-2xl bg-[var(--bg-surface)] ${ROUTE_COLORS[i % ROUTE_COLORS.length]} border p-3.5 text-left shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)] active:scale-[0.97]`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className={`h-4 w-4 ${ROUTE_ICONS[i % ROUTE_ICONS.length]} shrink-0`} />
                <span className="text-sm font-bold text-[var(--text-primary)] truncate">{route.title}</span>
              </div>
              <div className="flex gap-3 text-xs text-[var(--text-muted)]">
                {route.distance > 0 && <span>{dist.value} {dist.unit}</span>}
                {route.duration > 0 && <span>{route.duration} мин</span>}
                {route.checkpoints?.length > 0 && <span>{route.checkpoints.length} точек</span>}
              </div>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
