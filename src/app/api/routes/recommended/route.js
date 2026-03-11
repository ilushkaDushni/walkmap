import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/routes/recommended — рекомендованные маршруты для пользователя
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    // Маршруты, которые пользователь уже завершил
    const completed = await db.collection("completed_routes")
      .find({ userId, gpsVerified: true })
      .project({ routeId: 1 })
      .toArray();
    const completedIds = new Set(completed.map((c) => c.routeId));

    // Все опубликованные маршруты с количеством завершений (популярность)
    const routes = await db.collection("routes")
      .aggregate([
        { $match: { published: true, visible: { $ne: false } } },
        { $lookup: {
          from: "completed_routes",
          let: { rid: { $toString: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$routeId", "$$rid"] }, gpsVerified: true } },
            { $count: "count" },
          ],
          as: "completions",
        }},
        { $addFields: {
          completionCount: { $ifNull: [{ $arrayElemAt: ["$completions.count", 0] }, 0] },
        }},
        { $project: {
          title: 1,
          description: 1,
          distance: 1,
          duration: 1,
          difficulty: 1,
          coverImage: 1,
          completionCount: 1,
          createdAt: 1,
        }},
        { $sort: { completionCount: -1 } },
        { $limit: 30 },
      ])
      .toArray();

    // Фильтруем незавершённые, сортируем по популярности
    const recommended = routes
      .filter((r) => !completedIds.has(r._id.toString()))
      .slice(0, 10)
      .map((r) => ({
        id: r._id.toString(),
        title: r.title,
        description: r.description?.slice(0, 120) || "",
        distance: r.distance || 0,
        duration: r.duration || 0,
        difficulty: r.difficulty || "easy",
        coverImage: r.coverImage || null,
        completionCount: r.completionCount,
      }));

    return NextResponse.json({ routes: recommended });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
