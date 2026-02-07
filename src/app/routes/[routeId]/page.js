"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import routes from "@/data/routes.json";
import RouteMap from "@/components/RouteMap";

export default function RouteDetailPage() {
  const { routeId } = useParams();
  const route = routes.find((r) => r.id === routeId);

  if (!route) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">Маршрут не найден</h1>
        <p className="mb-6 text-[var(--text-muted)]">Такого маршрута не существует</p>
        <Link
          href="/"
          className="rounded-lg bg-green-600 px-6 py-3 text-white transition hover:bg-green-700"
        >
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-4">
      {/* Навигация назад */}
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Все маршруты
      </Link>

      {/* Заголовок */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{route.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{route.description}</p>
        <div className="mt-2 flex gap-4 text-xs text-[var(--text-muted)]">
          {route.distance && (
            <span>
              {route.distance >= 1000
                ? `${(route.distance / 1000).toFixed(1)} км`
                : `${route.distance} м`}
            </span>
          )}
          {route.duration && <span>{route.duration} мин</span>}
          <span>{route.stops.length} остановок</span>
        </div>
      </div>

      {/* Карта */}
      <RouteMap route={route} />
    </div>
  );
}
