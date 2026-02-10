import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

export async function GET() {
  try {
    const db = await getDb();

    // Проверяем ручной выбор админа
    const featured = await db.collection("featured_route").findOne({ type: "day" });
    if (featured) {
      const route = await db.collection("routes").findOne(
        { _id: new ObjectId(featured.routeId), status: "published" },
        { projection: { title: 1, description: 1, distance: 1, duration: 1, coverImage: 1, path: 1, checkpoints: 1 } }
      );
      if (route) {
        return NextResponse.json({ route, manual: true });
      }
    }

    // Фоллбек: автоматический выбор
    const routes = await db.collection("routes")
      .find({ status: "published", adminOnly: { $ne: true } })
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(4)
      .project({ title: 1, description: 1, distance: 1, duration: 1, coverImage: 1, path: 1, checkpoints: 1 })
      .toArray();

    return NextResponse.json({ routes, manual: false });
  } catch {
    return NextResponse.json({ routes: [], manual: false });
  }
}

// Установить маршрут дня/недели
export async function POST(request) {
  const auth = await requirePermission(request, "routes.set_featured");
  if (auth.error) return auth.error;

  try {
    const { routeId, type = "day" } = await request.json();
    if (!routeId) {
      return NextResponse.json({ error: "routeId обязателен" }, { status: 400 });
    }

    const db = await getDb();

    // Проверяем что маршрут существует
    const route = await db.collection("routes").findOne({ _id: new ObjectId(routeId) });
    if (!route) {
      return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    }

    await db.collection("featured_route").updateOne(
      { type },
      { $set: { routeId, type, setAt: new Date(), setBy: auth.user._id.toString() } },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, title: route.title, type });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// Сбросить маршрут дня (вернуть авто-выбор)
export async function DELETE(request) {
  const auth = await requirePermission(request, "routes.set_featured");
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "day";
    const db = await getDb();
    await db.collection("featured_route").deleteOne({ type });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
