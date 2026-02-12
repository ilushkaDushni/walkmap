import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { checkAndGrantAchievements } from "@/lib/achievementEngine";
import { createNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

// POST /api/lobbies/[id]/complete — завершить лобби (хост)
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || lobby.status !== "active") {
    return NextResponse.json({ error: "Лобби не найдено или неактивно" }, { status: 404 });
  }

  if (lobby.hostId !== auth.user._id.toString()) {
    return NextResponse.json({ error: "Только хост может завершить" }, { status: 403 });
  }

  // Получаем маршрут для монет
  const route = await db.collection("routes").findOne({ _id: new ObjectId(lobby.routeId) });
  const coinsToAward = route?.coins || lobby.hostState?.totalCoins || 10;

  const now = new Date();
  const results = [];

  // Для каждого участника
  for (const participant of lobby.participants) {
    const userId = participant.userId;

    // Проверяем не завершал ли уже этот маршрут
    const alreadyCompleted = await db.collection("completed_routes").findOne({
      userId,
      routeId: lobby.routeId,
    });

    if (!alreadyCompleted) {
      // Создаём completed_routes
      await db.collection("completed_routes").insertOne({
        userId,
        routeId: lobby.routeId,
        completedAt: now,
        coinsEarned: coinsToAward,
        gpsVerified: true,
        lobbyId: id,
      });

      // Начисляем монеты
      const updatedParticipant = await db.collection("users").findOneAndUpdate(
        { _id: new ObjectId(userId) },
        { $inc: { coins: coinsToAward } },
        { returnDocument: "after" }
      );
      await logCoinTransaction(db, {
        userId,
        type: "lobby_completion",
        amount: coinsToAward,
        balance: updatedParticipant?.coins || 0,
        meta: { lobbyId: id, routeId: lobby.routeId, routeTitle: route?.title },
      });
    }

    // Проверяем достижения
    const { newAchievements, rewardCoins } = await checkAndGrantAchievements(userId);

    results.push({
      userId,
      username: participant.username,
      coins: coinsToAward,
      newAchievements,
      achievementRewardCoins: rewardCoins,
      alreadyCompleted: !!alreadyCompleted,
    });
  }

  // Помечаем лобби как завершённое
  await db.collection("lobbies").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "completed", completedAt: now } }
  );

  return NextResponse.json({
    ok: true,
    results,
    routeTitle: route?.title || "",
  });
}
