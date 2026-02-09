import Link from "next/link";
import { TrendingUp, Clock, Pencil, Shield } from "lucide-react";
import { normalizeCoverImage, coverImageStyle } from "@/lib/coverImage";
import RouteCardMiniMap from "@/components/RouteCardMiniMap";

export default function RouteCard({ route, isAdmin, onToggleHidden }) {
  return (
    <Link
      href={`/routes/${route._id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm transition hover:shadow-md"
    >
      {/* Обложка */}
      <div className="relative h-48 overflow-hidden bg-[var(--bg-elevated)] transition group-hover:scale-[1.02]">
        {(() => {
          const cover = normalizeCoverImage(route.coverImage);
          if (cover) {
            const style = coverImageStyle(cover);
            return (
              <img
                src={cover.url}
                alt={route.title}
                className="h-full w-full object-cover"
                style={{
                  ...style,
                  transformOrigin: `${cover.posX}% ${cover.posY}%`,
                }}
              />
            );
          }
          return (
            <RouteCardMiniMap
              path={route.path}
              checkpoints={route.checkpoints}
            />
          );
        })()}
        <span className="absolute right-3 top-3 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] shadow-sm">
          {route.checkpoints?.length || 0} точек
        </span>
        {isAdmin && (
          <div className="absolute left-3 top-3 flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/admin/routes?edit=${route._id}`;
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-sm transition hover:text-blue-500"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleHidden?.(route._id, !route._hidden);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition ${
                route._hidden
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-orange-500"
              }`}
              title={route._hidden ? "Скрыт — нажмите чтобы показать" : "Виден — нажмите чтобы скрыть"}
            >
              <Shield className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="p-4">
        <h2 className="mb-1 text-lg font-bold text-[var(--text-primary)] group-hover:text-green-600 transition">
          {route.title}
        </h2>
        <p className="mb-3 line-clamp-2 text-sm text-[var(--text-muted)]">
          {route.description}
        </p>
        <div className="flex gap-4 text-xs text-[var(--text-muted)]">
          {route.distance > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {route.distance >= 1000
                ? `${(route.distance / 1000).toFixed(1)} км`
                : `${route.distance} м`}
            </span>
          )}
          {route.duration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {route.duration} мин
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
