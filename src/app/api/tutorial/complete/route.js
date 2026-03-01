import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { logCoinTransaction } from "@/lib/coinTransactions";

const TUTORIAL_REWARD = 100;

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();
  const userId = auth.userId;

  // Проверяем, не получал ли уже награду
  const user = await db.collection("users").findOne(
    { _id: userId },
    { projection: { tutorialCompleted: 1, coins: 1 } }
  );

  if (user?.tutorialCompleted) {
    return NextResponse.json({ rewarded: false, coins: user.coins || 0 });
  }

  // Начисляем монеты и помечаем туториал пройденным
  const result = await db.collection("users").findOneAndUpdate(
    { _id: userId, tutorialCompleted: { $ne: true } },
    {
      $inc: { coins: TUTORIAL_REWARD },
      $set: { tutorialCompleted: true },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    const updated = await db.collection("users").findOne({ _id: userId }, { projection: { coins: 1 } });
    return NextResponse.json({ rewarded: false, coins: updated?.coins || 0 });
  }

  await logCoinTransaction(db, {
    userId,
    type: "tutorial_reward",
    amount: TUTORIAL_REWARD,
    balance: result.coins,
    meta: { reason: "Прохождение обучения" },
  });

  return NextResponse.json({ rewarded: true, coins: result.coins, reward: TUTORIAL_REWARD });
}
