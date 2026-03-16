import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { checkAndGrantAchievements } from "@/lib/achievementEngine";
import { createNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

const RACE_PLACE_MULTIPLIERS = { 1: 2.0, 2: 1.5, 3: 1.0, 4: 0.5, 5: 0.5 };

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
  const baseCoins = route?.coins || lobby.hostState?.totalCoins || 10;
  const isRace = lobby.type === "race";

  const now = new Date();
  const results = [];

  if (isRace) {
    // === RACE COMPLETION: по местам ===
    const finished = lobby.raceState?.finishedParticipants || [];
    // Сортируем финишировавших по месту
    finished.sort((a, b) => a.place - b.place);

    // Участники, которые не финишировали
    const finishedIds = new Set(finished.map((f) => f.userId));
    const dnfParticipants = lobby.participants.filter((p) => !finishedIds.has(p.userId));

    // Обрабатываем финишировавших
    for (const fp of finished) {
      const userId = fp.userId;
      const participant = lobby.participants.find((p) => p.userId === userId);
      const multiplier = RACE_PLACE_MULTIPLIERS[fp.place] ?? 0.5;
      const coinsAwarded = Math.round(baseCoins * multiplier);

      const alreadyCompleted = await db.collection("completed_routes").findOne({
        userId,
        routeId: lobby.routeId,
      });

      if (!alreadyCompleted) {
        await db.collection("completed_routes").insertOne({
          userId,
          routeId: lobby.routeId,
          completedAt: fp.finishedAt || now,
          coinsEarned: coinsAwarded,
          gpsVerified: true,
          lobbyId: id,
          startedAt: lobby.raceState?.startedAt ? new Date(lobby.raceState.startedAt) : null,
          duration: fp.duration,
          pace: fp.pace,
        });

        const updatedUser = await db.collection("users").findOneAndUpdate(
          { _id: new ObjectId(userId) },
          { $inc: { coins: coinsAwarded } },
          { returnDocument: "after" }
        );
        await logCoinTransaction(db, {
          userId,
          type: "lobby_completion",
          amount: coinsAwarded,
          balance: updatedUser?.coins || 0,
          meta: { lobbyId: id, routeId: lobby.routeId, routeTitle: route?.title, racePlace: fp.place },
        });
      }

      const { newAchievements, rewardCoins } = await checkAndGrantAchievements(userId);

      results.push({
        userId,
        username: participant?.username || "?",
        avatarUrl: participant?.avatarUrl || null,
        equippedItems: participant?.equippedItems || null,
        coins: coinsAwarded,
        place: fp.place,
        duration: fp.duration,
        pace: fp.pace,
        newAchievements,
        achievementRewardCoins: rewardCoins,
        alreadyCompleted: !!alreadyCompleted,
        dnf: false,
      });
    }

    // DNF участники (не финишировали, 0 монет)
    for (const participant of dnfParticipants) {
      const { newAchievements, rewardCoins } = await checkAndGrantAchievements(participant.userId);
      results.push({
        userId: participant.userId,
        username: participant.username,
        avatarUrl: participant.avatarUrl || null,
        equippedItems: participant.equippedItems || null,
        coins: 0,
        place: null,
        duration: null,
        pace: null,
        newAchievements,
        achievementRewardCoins: rewardCoins,
        alreadyCompleted: false,
        dnf: true,
      });
    }

    // Сохраняем race_results
    await db.collection("race_results").insertOne({
      lobbyId: id,
      routeId: lobby.routeId,
      routeTitle: route?.title || "",
      participants: results.map((r) => ({
        userId: r.userId,
        username: r.username,
        avatarUrl: r.avatarUrl,
        place: r.place,
        duration: r.duration,
        pace: r.pace,
        coinsAwarded: r.coins,
        dnf: r.dnf,
      })),
      totalParticipants: lobby.participants.length,
      startedAt: lobby.raceState?.startedAt,
      completedAt: now,
    });
  } else {
    // === REGULAR LOBBY COMPLETION (walk/event) ===
    for (const participant of lobby.participants) {
      const userId = participant.userId;

      const alreadyCompleted = await db.collection("completed_routes").findOne({
        userId,
        routeId: lobby.routeId,
      });

      if (!alreadyCompleted) {
        const lobbyDuration = lobby.startedAt ? Math.round((now.getTime() - new Date(lobby.startedAt).getTime()) / 1000) : null;
        const lobbyPace = lobbyDuration && route?.distance > 0 ? Math.round(lobbyDuration / (route.distance / 1000)) : null;

        await db.collection("completed_routes").insertOne({
          userId,
          routeId: lobby.routeId,
          completedAt: now,
          coinsEarned: baseCoins,
          gpsVerified: true,
          lobbyId: id,
          startedAt: lobby.startedAt ? new Date(lobby.startedAt) : null,
          duration: lobbyDuration,
          pace: lobbyPace,
        });

        const updatedParticipant = await db.collection("users").findOneAndUpdate(
          { _id: new ObjectId(userId) },
          { $inc: { coins: baseCoins } },
          { returnDocument: "after" }
        );
        await logCoinTransaction(db, {
          userId,
          type: "lobby_completion",
          amount: baseCoins,
          balance: updatedParticipant?.coins || 0,
          meta: { lobbyId: id, routeId: lobby.routeId, routeTitle: route?.title },
        });
      }

      const { newAchievements, rewardCoins } = await checkAndGrantAchievements(userId);

      results.push({
        userId,
        username: participant.username,
        coins: baseCoins,
        newAchievements,
        achievementRewardCoins: rewardCoins,
        alreadyCompleted: !!alreadyCompleted,
      });
    }
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
    isRace,
  });
}
