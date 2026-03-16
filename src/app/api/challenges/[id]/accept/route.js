import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createAndPushNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

// POST /api/challenges/[id]/accept — принять вызов
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
  if (challenge.expiresAt < new Date()) {
    await db.collection("challenges").updateOne({ _id: challenge._id }, { $set: { status: "expired" } });
    return NextResponse.json({ error: "Вызов истёк" }, { status: 400 });
  }

  // Списываем ставку у challenged
  const stake = challenge.stakeCoins;
  if (stake > 0) {
    if ((auth.user.coins || 0) < stake) {
      return NextResponse.json({ error: "Недостаточно монет для ставки" }, { status: 400 });
    }
    const updated = await db.collection("users").findOneAndUpdate(
      { _id: auth.user._id, coins: { $gte: stake } },
      { $inc: { coins: -stake } },
      { returnDocument: "after" }
    );
    if (!updated) {
      return NextResponse.json({ error: "Недостаточно монет для ставки" }, { status: 400 });
    }
    await logCoinTransaction(db, {
      userId,
      type: "challenge_stake",
      amount: -stake,
      balance: updated.coins,
      meta: { challengeId: id },
    });
  }

  await db.collection("challenges").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "accepted" } }
  );

  // Уведомляем challenger
  await createAndPushNotification(challenge.challengerId, "challenge_accepted", {
    challengeId: id,
    challengedId: userId,
    challengedUsername: auth.user.username,
  });

  return NextResponse.json({ ok: true, status: "accepted" });
}
