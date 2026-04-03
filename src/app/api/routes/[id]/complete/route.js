import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { checkAndGrantAchievements } from "@/lib/achievementEngine";
import { logCoinTransaction } from "@/lib/coinTransactions";
import { checkAndResolveUserChallenges } from "@/lib/challengeResolver";

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Неверный ID маршрута" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const routeId = new ObjectId(id);

    // Проверяем что маршрут существует
    const route = await db.collection("routes").findOne({ _id: routeId });
    if (!route) {
      return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    }

    const userId = auth.user._id.toString();

    // Считаем максимум монет из маршрута
    const body = await request.json().catch(() => ({}));
    const checkpointCoins = (route.checkpoints || []).reduce((s, cp) => s + (cp.coinsReward || 0), 0);
    const finishCoins = route.finish?.coinsReward || 0;
    const maxPossibleCoins = checkpointCoins + finishCoins;
    const coins = Math.min(body.coins || 0, maxPossibleCoins);

    const gpsVerified = body.gpsVerified === true;
    const now = new Date();

    // Вычисляем длительность если передан startedAt
    let duration = null;
    let pace = null;
    let startedAt = null;
    if (body.startedAt) {
      startedAt = new Date(body.startedAt);
      duration = Math.round((now.getTime() - startedAt.getTime()) / 1000);
      // Валидация: от 30 секунд до 24 часов
      if (duration < 30 || duration > 86400) {
        duration = null;
        startedAt = null;
      } else if (route.distance > 0) {
        pace = Math.round(duration / (route.distance / 1000)); // сек/км
      }
    }

    // Атомарная вставка — уникальный индекс {userId, routeId} предотвращает дубли
    try {
      await db.collection("completed_routes").insertOne({
        userId,
        routeId: id,
        completedAt: now,
        coinsEarned: coins,
        gpsVerified,
        startedAt,
        duration,
        pace,
      });
    } catch (e) {
      if (e.code === 11000) {
        // Уже проходил — обновляем время если новый результат лучше
        let newBestTime = false;
        if (duration && gpsVerified) {
          const upd = await db.collection("completed_routes").updateOne(
            { userId, routeId: id, $or: [{ duration: null }, { duration: { $gt: duration } }] },
            { $set: { duration, pace, startedAt, completedAt: now, gpsVerified: true } }
          );
          newBestTime = upd.modifiedCount > 0;
        }

        // Начисляем монеты даже при повторном прохождении
        if (coins > 0) {
          const updatedUser = await db.collection("users").findOneAndUpdate(
            { _id: auth.user._id },
            { $inc: { coins } },
            { returnDocument: "after" }
          );
          await logCoinTransaction(db, {
            userId,
            type: "route_completion",
            amount: coins,
            balance: updatedUser.coins || 0,
            meta: { routeId: id, routeTitle: route.title, repeat: true },
          });
        }

        // Проверяем челленджи и достижения при повторном прохождении
        if (duration && gpsVerified) {
          try {
            await checkAndResolveUserChallenges(db, userId, id, { duration, pace, gpsVerified });
          } catch (err) {
            console.error("Challenge resolve error:", err);
          }
        }
        const { newAchievements: repeatAch, rewardCoins: repeatReward } = await checkAndGrantAchievements(auth.user._id);

        return NextResponse.json({
          alreadyCompleted: true,
          newBestTime,
          coins,
          newAchievements: repeatAch,
          achievementRewardCoins: repeatReward,
        });
      }
      throw e;
    }

    // Начисляем монеты
    if (coins > 0) {
      const updatedUser = await db.collection("users").findOneAndUpdate(
        { _id: auth.user._id },
        { $inc: { coins } },
        { returnDocument: "after" }
      );
      await logCoinTransaction(db, {
        userId,
        type: "route_completion",
        amount: coins,
        balance: updatedUser.coins || 0,
        meta: { routeId: id, routeTitle: route.title },
      });
    }

    // Проверяем активные челленджи
    if (duration && gpsVerified) {
      try {
        await checkAndResolveUserChallenges(db, userId, id, { duration, pace, gpsVerified });
      } catch (e) {
        console.error("Challenge resolve error:", e);
      }
    }

    // Проверяем достижения
    const { newAchievements, rewardCoins } = await checkAndGrantAchievements(auth.user._id);

    return NextResponse.json({
      success: true,
      coins,
      newAchievements,
      achievementRewardCoins: rewardCoins,
    });
  } catch (e) {
    console.error("Route complete error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
