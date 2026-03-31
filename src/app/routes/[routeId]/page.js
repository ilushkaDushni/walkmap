import Link from "next/link";
import { ChevronLeft, MapPin, Clock, Flag, Footprints } from "lucide-react";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import RouteMap from "@/components/RouteMap";
import RouteComments from "@/components/RouteComments";
import RouteRecords from "@/components/RouteRecords";
import RouteFeed from "@/components/RouteFeed";
import StartRouteButton from "@/components/StartRouteButton";
import ChallengeButton from "@/components/ChallengeButton";

export const dynamic = "force-dynamic";

const DIFFICULTY_MAP = {
  easy: { label: "Лёгкий", color: "bg-green-500/10 text-green-600" },
  medium: { label: "Средний", color: "bg-yellow-500/10 text-yellow-600" },
  hard: { label: "Сложный", color: "bg-red-500/10 text-red-600" },
};

export default async function RouteDetailPage({ params }) {
  const { routeId } = await params;

  if (!ObjectId.isValid(routeId)) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">Маршрут не найден</h1>
        <p className="mb-6 text-[var(--text-muted)]">Такого маршрута не существует</p>
        <Link
          href="/routes"
          className="rounded-xl bg-[var(--accent-color)] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
        >
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const db = await getDb();
  const route = await db.collection("routes").findOne({ _id: new ObjectId(routeId) });

  if (!route) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">Маршрут не найден</h1>
        <p className="mb-6 text-[var(--text-muted)]">Такого маршрута не существует</p>
        <Link
          href="/routes"
          className="rounded-xl bg-[var(--accent-color)] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
        >
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const serialized = {
    ...route,
    _id: route._id.toString(),
    createdBy: route.createdBy?.toString?.() || null,
  };

  const diff = DIFFICULTY_MAP[serialized.difficulty] || DIFFICULTY_MAP.easy;

  return (
    <div className="pb-24">
      {/* Full-width map */}
      <div className="relative w-full h-[280px] sm:h-[340px]">
        <div className="absolute inset-0 overflow-hidden">
          <RouteMap route={serialized} preview />
        </div>
        <Link
          href="/routes"
          className="absolute top-4 left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-surface)]/90 backdrop-blur-sm shadow-[var(--shadow-md)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-xl px-4 -mt-6 relative z-10">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] p-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{serialized.title}</h1>
          {serialized.description && (
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{serialized.description}</p>
          )}

          {/* Pill badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {serialized.distance > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
                <Footprints className="h-3 w-3" />
                {serialized.distance >= 1000
                  ? `${(serialized.distance / 1000).toFixed(1)} км`
                  : `${serialized.distance} м`}
              </span>
            )}
            {serialized.duration > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 text-xs font-medium">
                <Clock className="h-3 w-3" />
                {serialized.duration} мин
              </span>
            )}
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
              <Flag className="h-3 w-3" />
              {serialized.checkpoints?.length || 0} точек
            </span>
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${diff.color}`}>
              <MapPin className="h-3 w-3" />
              {diff.label}
            </span>
          </div>
        </div>

        {/* Начать маршрут */}
        <div className="mt-4 space-y-2">
          <StartRouteButton route={serialized} />
          <ChallengeButton routeId={serialized._id} routeTitle={serialized.title} />
        </div>

        {/* Рекорды */}
        <div className="mt-4">
          <RouteRecords routeId={serialized._id} />
        </div>

        {/* Лента (фото + комменты пользователей) */}
        <div className="mt-4">
          <RouteFeed routeId={serialized._id} checkpoints={serialized.checkpoints || []} />
        </div>

        {/* Comments */}
        <div className="mt-4">
          <RouteComments routeId={serialized._id} />
        </div>
      </div>
    </div>
  );
}
