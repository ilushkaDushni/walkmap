import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/stats/activity-feed — лента активности (последние действия пользователей)
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    // Получаем друзей
    const friendships = await db.collection("friendships")
      .find({ users: userId, status: "accepted" })
      .toArray();
    const friendIds = friendships.flatMap((f) => f.users.filter((id) => id !== userId));

    // Берём последние 20 активностей друзей и себя
    const targetIds = [userId, ...friendIds];

    const [completions, comments] = await Promise.all([
      // Завершённые маршруты
      db.collection("completed_routes")
        .aggregate([
          { $match: { userId: { $in: targetIds }, gpsVerified: true } },
          { $sort: { completedAt: -1 } },
          { $limit: 15 },
          { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
          { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
          { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
          { $addFields: { userObjId: { $toObjectId: "$userId" } } },
          { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          { $project: {
            type: { $literal: "completion" },
            userId: 1,
            username: "$user.username",
            avatarUrl: "$user.avatarUrl",
            routeTitle: "$route.title",
            routeId: 1,
            createdAt: "$completedAt",
          }},
        ])
        .toArray(),

      // Комментарии
      db.collection("comments")
        .aggregate([
          { $match: { userId: { $in: targetIds } } },
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
          { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
          { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
          { $addFields: { userObjId: { $toObjectId: "$userId" } } },
          { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          { $project: {
            type: { $literal: "comment" },
            userId: 1,
            username: "$user.username",
            avatarUrl: "$user.avatarUrl",
            routeTitle: "$route.title",
            routeId: 1,
            text: { $substrCP: ["$text", 0, 100] },
            createdAt: 1,
          }},
        ])
        .toArray(),
    ]);

    // Объединяем и сортируем по дате
    const feed = [...completions, ...comments]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    return NextResponse.json({ feed });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
