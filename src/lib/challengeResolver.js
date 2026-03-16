import { ObjectId } from "mongodb";
import { createAndPushNotification } from "./notifications";
import { logCoinTransaction } from "./coinTransactions";

/**
 * Резолвит челлендж: сравнивает duration обоих участников,
 * определяет победителя, начисляет монеты.
 * Вызывать когда оба результата есть.
 *
 * @param {import('mongodb').Db} db
 * @param {object} challenge — документ из коллекции challenges
 * @returns {{ winnerId: string|null, isDraw: boolean }}
 */
export async function resolveChallenge(db, challenge) {
  const { challengerResult, challengedResult, stakeCoins } = challenge;
  const challengeId = challenge._id.toString();

  let winnerId = null;
  let loserId = null;
  let isDraw = false;

  if (challengerResult.duration < challengedResult.duration) {
    winnerId = challenge.challengerId;
    loserId = challenge.challengedId;
  } else if (challengedResult.duration < challengerResult.duration) {
    winnerId = challenge.challengedId;
    loserId = challenge.challengerId;
  } else {
    isDraw = true;
  }

  const now = new Date();

  if (isDraw) {
    // Ничья — возвращаем ставки обоим
    for (const uid of [challenge.challengerId, challenge.challengedId]) {
      const updated = await db.collection("users").findOneAndUpdate(
        { _id: new ObjectId(uid) },
        { $inc: { coins: stakeCoins } },
        { returnDocument: "after" }
      );
      await logCoinTransaction(db, {
        userId: uid,
        type: "challenge_refund",
        amount: stakeCoins,
        balance: updated?.coins || 0,
        meta: { challengeId },
      });
    }

    await db.collection("challenges").updateOne(
      { _id: challenge._id },
      { $set: { status: "completed", winnerId: null, resolvedAt: now } }
    );

    // Уведомления
    for (const uid of [challenge.challengerId, challenge.challengedId]) {
      await createAndPushNotification(uid, "challenge_draw", {
        challengeId,
        stakeCoins,
      });
    }
  } else {
    // Победитель забирает x2
    const prize = stakeCoins * 2;
    const winnerUpdated = await db.collection("users").findOneAndUpdate(
      { _id: new ObjectId(winnerId) },
      { $inc: { coins: prize } },
      { returnDocument: "after" }
    );
    await logCoinTransaction(db, {
      userId: winnerId,
      type: "challenge_win",
      amount: prize,
      balance: winnerUpdated?.coins || 0,
      meta: { challengeId },
    });

    await db.collection("challenges").updateOne(
      { _id: challenge._id },
      { $set: { status: "completed", winnerId, resolvedAt: now } }
    );

    // Уведомления
    await createAndPushNotification(winnerId, "challenge_won", {
      challengeId,
      prize,
      opponentId: loserId,
    });
    await createAndPushNotification(loserId, "challenge_lost", {
      challengeId,
      prize,
      opponentId: winnerId,
    });
  }

  return { winnerId, isDraw };
}

/**
 * Проверяет активные accepted-челленджи для пользователя на данном маршруте
 * и резолвит если оба результата заполнены.
 *
 * @param {import('mongodb').Db} db
 * @param {string} userId
 * @param {string} routeId
 * @param {{ duration: number, pace: number|null, gpsVerified: boolean }} result
 */
export async function checkAndResolveUserChallenges(db, userId, routeId, result) {
  const now = new Date();

  // Все accepted челленджи на этот маршрут где юзер участвует
  const challenges = await db.collection("challenges").find({
    routeId,
    status: "accepted",
    $or: [{ challengerId: userId }, { challengedId: userId }],
  }).toArray();

  for (const ch of challenges) {
    const isChallenger = ch.challengerId === userId;
    const resultField = isChallenger ? "challengerResult" : "challengedResult";

    // Записываем результат (если ещё не записан)
    const existing = isChallenger ? ch.challengerResult : ch.challengedResult;
    if (existing) continue;

    const resultData = {
      duration: result.duration,
      pace: result.pace,
      completedAt: now,
      gpsVerified: result.gpsVerified,
    };

    await db.collection("challenges").updateOne(
      { _id: ch._id },
      { $set: { [resultField]: resultData } }
    );

    // Проверяем есть ли результат второго участника
    const otherResult = isChallenger ? ch.challengedResult : ch.challengerResult;
    if (otherResult) {
      // Оба прошли — резолвим
      const updated = await db.collection("challenges").findOne({ _id: ch._id });
      await resolveChallenge(db, updated);
    }
  }
}
