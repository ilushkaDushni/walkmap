import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createAndPushNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

// POST /api/challenges — создать вызов
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { challengedId, routeId, stakeCoins = 0 } = await request.json();
  const challengerId = auth.user._id.toString();

  if (!challengedId || !routeId) {
    return NextResponse.json({ error: "challengedId и routeId обязательны" }, { status: 400 });
  }
  if (challengerId === challengedId) {
    return NextResponse.json({ error: "Нельзя вызвать самого себя" }, { status: 400 });
  }
  if (!ObjectId.isValid(routeId)) {
    return NextResponse.json({ error: "Некорректный routeId" }, { status: 400 });
  }

  const stake = Math.max(0, Math.min(500, Math.floor(Number(stakeCoins) || 0)));

  const db = await getDb();

  // Проверяем маршрут
  const route = await db.collection("routes").findOne({ _id: new ObjectId(routeId) });
  if (!route) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  // Проверяем что challenged существует
  if (!ObjectId.isValid(challengedId)) {
    return NextResponse.json({ error: "Некорректный challengedId" }, { status: 400 });
  }
  const challengedUser = await db.collection("users").findOne({ _id: new ObjectId(challengedId) });
  if (!challengedUser) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  // Проверяем что challenger прошёл маршрут
  const challengerCompletion = await db.collection("completed_routes").findOne({
    userId: challengerId,
    routeId: routeId.toString(),
    gpsVerified: true,
    duration: { $ne: null },
  });
  if (!challengerCompletion) {
    return NextResponse.json({ error: "Сначала пройдите маршрут с GPS" }, { status: 400 });
  }

  // Проверяем нет ли уже активного челленджа между ними на этот маршрут
  const existing = await db.collection("challenges").findOne({
    routeId: routeId.toString(),
    status: { $in: ["pending", "accepted"] },
    $or: [
      { challengerId, challengedId },
      { challengerId: challengedId, challengedId: challengerId },
    ],
  });
  if (existing) {
    return NextResponse.json({ error: "Уже есть активный вызов на этот маршрут" }, { status: 400 });
  }

  // Списываем ставку у challenger
  if (stake > 0) {
    if ((auth.user.coins || 0) < stake) {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }
    const updated = await db.collection("users").findOneAndUpdate(
      { _id: auth.user._id, coins: { $gte: stake } },
      { $inc: { coins: -stake } },
      { returnDocument: "after" }
    );
    if (!updated) {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }
    await logCoinTransaction(db, {
      userId: challengerId,
      type: "challenge_stake",
      amount: -stake,
      balance: updated.coins,
      meta: { routeId: routeId.toString() },
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 часов

  const challenge = {
    challengerId,
    challengedId,
    routeId: routeId.toString(),
    status: "pending",
    stakeCoins: stake,
    challengerResult: {
      duration: challengerCompletion.duration,
      pace: challengerCompletion.pace,
      completedAt: challengerCompletion.completedAt,
      gpsVerified: true,
    },
    challengedResult: null,
    winnerId: null,
    expiresAt,
    resolvedAt: null,
    createdAt: now,
  };

  const result = await db.collection("challenges").insertOne(challenge);
  const challengeId = result.insertedId.toString();

  // Уведомление
  await createAndPushNotification(challengedId, "challenge_received", {
    challengeId,
    challengerId,
    challengerUsername: auth.user.username,
    routeId: routeId.toString(),
    routeTitle: route.title,
    stakeCoins: stake,
  });

  // Отправляем карточку в чат
  const conversationKey = [challengerId, challengedId].sort().join("_");
  await db.collection("messages").insertOne({
    conversationKey,
    senderId: challengerId,
    senderUsername: auth.user.username,
    senderAvatarUrl: auth.user.avatarUrl || null,
    type: "challenge",
    text: "",
    challengeData: {
      challengeId,
      routeTitle: route.title,
      routeId: routeId.toString(),
      stakeCoins: stake,
      challengerTime: challengerCompletion.duration,
      status: "pending",
    },
    reactions: [],
    readBy: [challengerId],
    createdAt: now,
  });

  return NextResponse.json({
    id: challengeId,
    status: "pending",
    routeTitle: route.title,
    stakeCoins: stake,
    expiresAt,
  }, { status: 201 });
}

// GET /api/challenges — мои челленджи
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // pending, accepted, completed, expired, declined
  const role = searchParams.get("role"); // challenger, challenged, all (default)
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  const db = await getDb();

  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (role === "challenger") {
    filter.challengerId = userId;
  } else if (role === "challenged") {
    filter.challengedId = userId;
  } else {
    filter.$or = [{ challengerId: userId }, { challengedId: userId }];
  }

  // Lazy expiration: помечаем просроченные pending
  await db.collection("challenges").updateMany(
    { status: "pending", expiresAt: { $lt: new Date() } },
    { $set: { status: "expired" } }
  );

  const challenges = await db.collection("challenges")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  // Подтягиваем имена и аватарки
  const userIds = new Set();
  for (const ch of challenges) {
    userIds.add(ch.challengerId);
    userIds.add(ch.challengedId);
  }

  const users = await db.collection("users").find(
    { _id: { $in: [...userIds].map((id) => new ObjectId(id)) } },
    { projection: { username: 1, avatarUrl: 1, equippedItems: 1 } }
  ).toArray();
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  // Подтягиваем названия маршрутов
  const routeIds = [...new Set(challenges.map((ch) => ch.routeId))];
  const routes = await db.collection("routes").find(
    { _id: { $in: routeIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) } },
    { projection: { title: 1 } }
  ).toArray();
  const routeMap = Object.fromEntries(routes.map((r) => [r._id.toString(), r.title]));

  const result = challenges.map((ch) => ({
    id: ch._id.toString(),
    challengerId: ch.challengerId,
    challengedId: ch.challengedId,
    challengerUsername: userMap[ch.challengerId]?.username || "?",
    challengerAvatarUrl: userMap[ch.challengerId]?.avatarUrl || null,
    challengedUsername: userMap[ch.challengedId]?.username || "?",
    challengedAvatarUrl: userMap[ch.challengedId]?.avatarUrl || null,
    routeId: ch.routeId,
    routeTitle: routeMap[ch.routeId] || "?",
    status: ch.status,
    stakeCoins: ch.stakeCoins,
    challengerResult: ch.challengerResult,
    challengedResult: ch.challengedResult,
    winnerId: ch.winnerId,
    expiresAt: ch.expiresAt,
    createdAt: ch.createdAt,
  }));

  return NextResponse.json({ challenges: result });
}
