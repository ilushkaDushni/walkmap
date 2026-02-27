import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

function isRouteHidden(route, folderMap) {
  if (route.adminOnly) return true;
  const fids = Array.isArray(route.folderIds)
    ? route.folderIds.map(String)
    : route.folderId ? [String(route.folderId)] : [];
  if (fids.length > 0) {
    const rid = route._id.toString();
    return fids.every((fid) => {
      const folder = folderMap[fid];
      if (!folder?.adminOnly) return false;
      return !(folder.exceptions || []).includes(rid);
    });
  }
  return false;
}

export async function GET() {
  try {
    const db = await getDb();

    const folders = await db.collection("folders").find({}).toArray();
    const folderMap = {};
    for (const f of folders) folderMap[f._id.toString()] = f;

    // Проверяем ручной выбор админа
    const featured = await db.collection("featured_route").findOne({ type: "day" });
    if (featured) {
      const route = await db.collection("routes").findOne(
        { _id: new ObjectId(featured.routeId), status: "published" },
        { projection: { title: 1, description: 1, distance: 1, duration: 1, coverImage: 1, path: 1, checkpoints: 1, adminOnly: 1, folderIds: 1, folderId: 1 } }
      );
      if (route && !isRouteHidden(route, folderMap)) {
        return NextResponse.json({ route, manual: true });
      }
    }

    // Фоллбек: автоматический выбор (фильтруем скрытые по папкам)
    const routes = await db.collection("routes")
      .find({ status: "published", adminOnly: { $ne: true } })
      .sort({ sortOrder: 1, createdAt: -1 })
      .project({ title: 1, description: 1, distance: 1, duration: 1, coverImage: 1, path: 1, checkpoints: 1, folderIds: 1, folderId: 1 })
      .toArray();

    const visible = routes.filter((r) => !isRouteHidden(r, folderMap)).slice(0, 4);

    return NextResponse.json({ routes: visible, manual: false });
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
