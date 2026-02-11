import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ACHIEVEMENT_REGISTRY } from "@/lib/achievements";

/**
 * Проверяет и выдаёт новые достижения пользователю.
 * Вызывать после действий, меняющих stats (завершение маршрута и т.д.).
 *
 * @param {string|ObjectId} userId
 * @param {object} [opts]
 * @param {boolean} [opts.grantReward=true] — начислять бонусные монеты
 * @returns {{ newAchievements: string[], rewardCoins: number }}
 */
export async function checkAndGrantAchievements(userId, { grantReward = true } = {}) {
  const db = await getDb();
  const uid = typeof userId === "string" ? new ObjectId(userId) : userId;

  // Загружаем пользователя
  const user = await db.collection("users").findOne({ _id: uid });
  if (!user) return { newAchievements: [], rewardCoins: 0 };

  // Собираем stats
  const userIdStr = uid.toString();
  const gpsFilter = { userId: userIdStr, gpsVerified: true };
  const [completedRoutes, distAgg] = await Promise.all([
    db.collection("completed_routes").countDocuments(gpsFilter),
    db.collection("completed_routes").aggregate([
      { $match: gpsFilter },
      { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
      { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
      { $unwind: "$route" },
      { $group: { _id: null, total: { $sum: "$route.distance" } } },
    ]).toArray(),
  ]);

  const stats = {
    completedRoutes,
    totalDistanceM: distAgg[0]?.total || 0,
    coins: user.coins || 0,
  };

  // Уже полученные slugs
  const existing = new Set((user.achievements || []).map((a) => a.slug));

  // Проверяем каждое достижение из реестра
  const newAchievements = [];
  let rewardCoins = 0;

  for (const def of ACHIEVEMENT_REGISTRY) {
    if (existing.has(def.slug)) continue;
    if (!def.check(stats)) continue;

    newAchievements.push(def.slug);
    if (grantReward) rewardCoins += def.reward;
  }

  if (newAchievements.length === 0) {
    return { newAchievements: [], rewardCoins: 0 };
  }

  // Записываем в БД
  const now = new Date();
  const pushEntries = newAchievements.map((slug) => ({
    slug,
    unlockedAt: now,
    rewardClaimed: grantReward,
  }));

  const update = {
    $push: { achievements: { $each: pushEntries } },
  };
  if (grantReward && rewardCoins > 0) {
    update.$inc = { coins: rewardCoins };
  }

  await db.collection("users").updateOne({ _id: uid }, update);

  return { newAchievements, rewardCoins };
}
