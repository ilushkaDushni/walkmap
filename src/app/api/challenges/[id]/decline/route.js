import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createAndPushNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

// POST /api/challenges/[id]/decline — отклонить вызов
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();

  const challenge = await db.collection("challenges").findOne({ _id: new ObjectId(id) });
  if (!challenge) {
    return NextResponse.json({ error: "Вызов не найден" }, { status: 404 });
  }
  if (challenge.challengedId !== userId) {
    return NextResponse.json({ error: "Этот вызов адресован не вам" }, { status: 403 });
  }
  if (challenge.status !== "pending") {
    return NextResponse.json({ error: "Вызов уже обработан" }, { status: 400 });
  }

  await db.collection("challenges").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "declined" } }
  );

  // Возвращаем ставку challenger
  const stake = challenge.stakeCoins;
  if (stake > 0) {
    const updated = await db.collection("users").findOneAndUpdate(
      { _id: new ObjectId(challenge.challengerId) },
      { $inc: { coins: stake } },
      { returnDocument: "after" }
    );
    await logCoinTransaction(db, {
      userId: challenge.challengerId,
      type: "challenge_refund",
      amount: stake,
      balance: updated?.coins || 0,
      meta: { challengeId: id },
    });
  }

  // Уведомляем challenger
  await createAndPushNotification(challenge.challengerId, "challenge_declined", {
    challengeId: id,
    challengedId: userId,
    challengedUsername: auth.user.username,
  });

  return NextResponse.json({ ok: true, status: "declined" });
}
