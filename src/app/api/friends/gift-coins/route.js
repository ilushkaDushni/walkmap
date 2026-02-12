import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";
import { logCoinTransaction } from "@/lib/coinTransactions";

// POST /api/friends/gift-coins — перевод монет другу
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { friendId, amount } = await request.json();

  if (!friendId || !ObjectId.isValid(friendId)) {
    return NextResponse.json({ error: "Некорректный ID друга" }, { status: 400 });
  }

  const parsedAmount = parseInt(amount, 10);
  if (!parsedAmount || parsedAmount < 1 || parsedAmount > 100) {
    return NextResponse.json({ error: "Сумма от 1 до 100 монет" }, { status: 400 });
  }

  const userId = auth.user._id.toString();

  if (friendId === userId) {
    return NextResponse.json({ error: "Нельзя подарить монеты себе" }, { status: 400 });
  }

  const db = await getDb();

  // Проверяем дружбу
  const users = [userId, friendId].sort();
  const friendship = await db.collection("friendships").findOne({
    users,
    status: "accepted",
  });

  if (!friendship) {
    return NextResponse.json({ error: "Можно дарить монеты только друзьям" }, { status: 403 });
  }

  // Атомарно списываем у отправителя (условие $gte гарантирует достаточность баланса)
  const senderResult = await db.collection("users").updateOne(
    { _id: auth.user._id, coins: { $gte: parsedAmount } },
    { $inc: { coins: -parsedAmount } }
  );

  if (senderResult.modifiedCount === 0) {
    return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
  }

  // Начисляем получателю
  const updatedFriend = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(friendId) },
    { $inc: { coins: parsedAmount } },
    { returnDocument: "after" }
  );

  // Возвращаем новый баланс отправителя
  const updatedSender = await db.collection("users").findOne({ _id: auth.user._id });

  // Логируем транзакции
  await logCoinTransaction(db, {
    userId,
    type: "gift_sent",
    amount: -parsedAmount,
    balance: updatedSender.coins || 0,
    meta: { friendId, friendUsername: updatedFriend?.username },
  });
  await logCoinTransaction(db, {
    userId: friendId,
    type: "gift_received",
    amount: parsedAmount,
    balance: updatedFriend?.coins || 0,
    meta: { fromUserId: userId, fromUsername: auth.user.username },
  });

  // Уведомление получателю
  await createNotification(friendId, "coin_gift", {
    userId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
    amount: parsedAmount,
  });

  return NextResponse.json({
    ok: true,
    newBalance: updatedSender.coins || 0,
    giftedAmount: parsedAmount,
  });
}
