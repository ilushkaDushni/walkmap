import { MapPinOff } from "lucide-react";
import RoutesListClient from "./RoutesListClient";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const db = await getDb();
  const routes = await db
    .collection("routes")
    .find({ status: "published" })
    .sort({ createdAt: -1 })
    .toArray();

  // Сериализация ObjectId для клиента
  const serialized = routes.map((r) => ({
    ...r,
    _id: r._id.toString(),
    createdBy: r.createdBy?.toString?.() || null,
  }));

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Маршруты</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Выберите маршрут и отправляйтесь на прогулку
        </p>
      </div>

      {serialized.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--text-muted)]">
          <MapPinOff className="mb-4 h-16 w-16" strokeWidth={1} />
          <p>Маршруты пока не добавлены</p>
        </div>
      ) : (
        <RoutesListClient routes={serialized} />
      )}
    </div>
  );
}
