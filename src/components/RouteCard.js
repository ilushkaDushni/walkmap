import Link from "next/link";
import { MapPin, TrendingUp, Clock, Pencil } from "lucide-react";

export default function RouteCard({ route, isAdmin }) {
  return (
    <Link
      href={`/routes/${route._id}`}
      className="group block overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm transition hover:shadow-md"
    >
      {/* Обложка */}
      <div className="relative h-48 overflow-hidden bg-[var(--bg-elevated)]">
        {route.coverImage ? (
          <img
            src={route.coverImage}
            alt={route.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
            <MapPin className="h-16 w-16" strokeWidth={1} />
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] shadow-sm">
          {route.checkpoints?.length || 0} точек
        </span>
        {isAdmin && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `/admin/routes?edit=${route._id}`;
            }}
            className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-sm transition hover:text-blue-500"
          >
            <Pencil className="h-4 w-4" />
          </button>
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
