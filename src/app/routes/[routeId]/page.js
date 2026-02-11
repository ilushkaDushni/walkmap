import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import RouteMap from "@/components/RouteMap";
import RouteComments from "@/components/RouteComments";

export const dynamic = "force-dynamic";

export default async function RouteDetailPage({ params }) {
  const { routeId } = await params;

  if (!ObjectId.isValid(routeId)) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">Маршрут не найден</h1>
        <p className="mb-6 text-[var(--text-muted)]">Такого маршрута не существует</p>
        <Link
          href="/routes"
          className="rounded-lg bg-green-600 px-6 py-3 text-white transition hover:bg-green-700"
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
          className="rounded-lg bg-green-600 px-6 py-3 text-white transition hover:bg-green-700"
        >
          Вернуться к списку
        </Link>
      </div>
    );
  }

  // Сериализация для клиента
  const serialized = {
    ...route,
    _id: route._id.toString(),
    createdBy: route.createdBy?.toString?.() || null,
  };

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-24">
      <Link
        href="/routes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Все маршруты
      </Link>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{serialized.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{serialized.description}</p>
        <div className="mt-2 flex gap-4 text-xs text-[var(--text-muted)]">
          {serialized.distance > 0 && (
            <span>
              {serialized.distance >= 1000
                ? `${(serialized.distance / 1000).toFixed(1)} км`
                : `${serialized.distance} м`}
            </span>
          )}
          {serialized.duration > 0 && <span>{serialized.duration} мин</span>}
          <span>{serialized.checkpoints?.length || 0} точек</span>
        </div>
      </div>

      <RouteMap route={serialized} />

      <RouteComments routeId={serialized._id} />
    </div>
  );
}
