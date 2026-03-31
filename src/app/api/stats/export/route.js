import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { ACHIEVEMENT_REGISTRY } from "@/lib/achievements";

// GET /api/stats/export — расширенная статистика для PDF-экспорта
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    // Все прохождения с данными маршрутов
    const completions = await db
      .collection("completed_routes")
      .aggregate([
        { $match: { userId } },
        { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
        {
          $lookup: {
            from: "routes",
            localField: "routeObjId",
            foreignField: "_id",
            as: "route",
          },
        },
        { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
        { $sort: { completedAt: -1 } },
      ])
      .toArray();

    // Лучшие рекорды (маршруты с временем)
    const records = completions
      .filter((c) => c.duration && c.route)
      .map((c) => ({
        routeTitle: c.route.title,
        distance: c.route.distance || 0,
        duration: c.duration,
        pace: c.pace,
        completedAt: c.completedAt,
      }));

    // Суммарная статистика
    const totalDistanceM = completions.reduce((s, c) => s + (c.route?.distance || 0), 0);
    const totalDurationS = completions.reduce((s, c) => s + (c.duration || 0), 0);
    const totalCoinsEarned = completions.reduce((s, c) => s + (c.coinsEarned || 0), 0);

    // Достижения
    const userAchSlugs = new Set((auth.user.achievements || []).map((a) => a.slug));
    const achievements = ACHIEVEMENT_REGISTRY.map((a) => ({
      title: a.title,
      description: a.description,
      unlocked: userAchSlugs.has(a.slug),
      rarity: a.color,
      reward: a.reward,
    }));

    // Друзья (количество)
    const friendsCount = await db.collection("friendships").countDocuments({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: "accepted",
    });

    return NextResponse.json({
      user: {
        username: auth.user.username,
        email: auth.user.email,
        coins: auth.user.coins || 0,
        createdAt: auth.user.createdAt,
      },
      stats: {
        completedRoutes: completions.length,
        totalDistanceM,
        totalDurationS,
        totalCoinsEarned,
        friendsCount,
      },
      records: records.slice(0, 20),
      achievements,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Stats export error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
