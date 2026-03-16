import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ACHIEVEMENT_REGISTRY, ACHIEVEMENT_MAP } from "@/lib/achievements";
import { createNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

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
  // Ночные часы: 00:00–05:00 МСК = 21:00–01:59 UTC
  const nightHoursUTC = [21, 22, 23, 0, 1];

  const [completedRoutes, distAgg, commentsCount, nightDoc, duelsCompleted, duelsWon, racesFinished, racesWon, racesPodium] = await Promise.all([
    db.collection("completed_routes").countDocuments(gpsFilter),
    db.collection("completed_routes").aggregate([
      { $match: gpsFilter },
      { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
      { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
      { $unwind: "$route" },
      { $group: { _id: null, total: { $sum: "$route.distance" } } },
    ]).toArray(),
    db.collection("comments").countDocuments({ userId: userIdStr }),
    db.collection("completed_routes").findOne({
      ...gpsFilter,
      $expr: { $in: [{ $hour: "$completedAt" }, nightHoursUTC] },
    }),
    // Дуэли: завершённые (участвовал)
    db.collection("challenges").countDocuments({
      status: "completed",
      $or: [{ challengerId: userIdStr }, { challengedId: userIdStr }],
    }),
    // Дуэли: победы
    db.collection("challenges").countDocuments({
      status: "completed",
      winnerId: userIdStr,
    }),
    // Гонки: финишировал
    db.collection("race_results").countDocuments({
      "participants.userId": userIdStr,
      "participants.dnf": { $ne: true },
    }),
    // Гонки: победы (1 место)
    db.collection("race_results").countDocuments({
      participants: { $elemMatch: { userId: userIdStr, place: 1 } },
    }),
    // Гонки: подиум (топ-3)
    db.collection("race_results").countDocuments({
      participants: { $elemMatch: { userId: userIdStr, place: { $lte: 3 } } },
    }),
  ]);

  // Серия побед в дуэлях (последние N дуэлей)
  let duelWinStreak = 0;
  const recentDuels = await db.collection("challenges").find({
    status: "completed",
    winnerId: { $ne: null },
    $or: [{ challengerId: userIdStr }, { challengedId: userIdStr }],
  }).sort({ resolvedAt: -1 }).limit(50).toArray();
  for (const d of recentDuels) {
    if (d.winnerId === userIdStr) duelWinStreak++;
    else break;
  }

  const stats = {
    completedRoutes,
    totalDistanceM: distAgg[0]?.total || 0,
    coins: user.coins || 0,
    commentsCount,
    hasNightCompletion: nightDoc !== null,
    duelsCompleted,
    duelsWon,
    duelWinStreak,
    racesFinished,
    racesWon,
    racesPodium,
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

  // Логируем транзакцию монет за достижения
  if (grantReward && rewardCoins > 0) {
    const updatedUser = await db.collection("users").findOne({ _id: uid });
    await logCoinTransaction(db, {
      userId: userIdStr,
      type: "achievement",
      amount: rewardCoins,
      balance: updatedUser?.coins || 0,
      meta: { achievements: newAchievements },
    });
  }

  // Уведомления о новых достижениях
  for (const slug of newAchievements) {
    const def = ACHIEVEMENT_MAP[slug];
    await createNotification(uid, "achievement", {
      slug,
      title: def?.title || slug,
      reward: def?.reward || 0,
    });
  }

  return { newAchievements, rewardCoins };
}
