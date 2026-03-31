import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// GET /api/heatmap — точки для тепловой карты
// Гибридный подход: GPS-треки + пути маршрутов, взвешенные по прохождениям
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "all"; // all | month | week
  const source = searchParams.get("source") || "hybrid"; // hybrid | gps | routes

  const db = await getDb();
  const features = [];

  // Фильтр по времени
  let dateFilter = {};
  if (range === "week") {
    dateFilter = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  } else if (range === "month") {
    dateFilter = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }

  // 1. GPS-треки (реальные точки где гуляли пользователи)
  if (source === "hybrid" || source === "gps") {
    const gpsFilter = { status: "finished" };
    if (dateFilter.$gte) {
      gpsFilter.finishedAt = dateFilter;
    }

    const tracks = await db
      .collection("gps_tracks")
      .find(gpsFilter, { projection: { points: 1 } })
      .limit(500)
      .toArray();

    for (const track of tracks) {
      if (!Array.isArray(track.points)) continue;
      // Прореживаем точки — каждую N-ю для производительности
      const step = track.points.length > 100 ? Math.ceil(track.points.length / 100) : 1;
      for (let i = 0; i < track.points.length; i += step) {
        const p = track.points[i];
        if (p?.lat && p?.lng) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { weight: 1 },
          });
        }
      }
    }
  }

  // 2. Пути маршрутов, взвешенные по количеству прохождений
  if (source === "hybrid" || source === "routes") {
    // Считаем количество прохождений каждого маршрута
    const completionFilter = {};
    if (dateFilter.$gte) {
      completionFilter.completedAt = dateFilter;
    }

    const completionCounts = await db
      .collection("completed_routes")
      .aggregate([
        { $match: completionFilter },
        { $group: { _id: "$routeId", count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = {};
    for (const c of completionCounts) {
      countMap[c._id] = c.count;
    }

    // Берём опубликованные маршруты с path
    const routes = await db
      .collection("routes")
      .find({ status: "published", "path.0": { $exists: true } }, { projection: { path: 1 } })
      .toArray();

    for (const route of routes) {
      const routeId = route._id.toString();
      const completions = countMap[routeId] || 0;

      // Базовый вес 1 для всех маршрутов, больше прохождений — ярче (1-10)
      const normalizedWeight = Math.min(10, 1 + Math.ceil(completions / 2));

      // Прореживаем path
      const path = route.path;
      const step = path.length > 50 ? Math.ceil(path.length / 50) : 1;
      for (let i = 0; i < path.length; i += step) {
        const p = path[i];
        if (p?.lat && p?.lng) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { weight: normalizedWeight },
          });
        }
      }
    }
  }

  const geojson = {
    type: "FeatureCollection",
    features,
  };

  return NextResponse.json(geojson, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
