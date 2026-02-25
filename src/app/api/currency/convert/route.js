import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/currency/convert — конвертация монет → маршрутики
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const { amount } = await request.json();

  if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: "Укажите целое положительное количество монет" }, { status: 400 });
  }

  const db = await getDb();

  // Получаем курс
  const setting = await db.collection("currency_settings").findOne({ key: "exchange_rate" });
  const rate = setting?.value || 10;

  if (amount < rate) {
    return NextResponse.json({ error: `Минимум ${rate} монет для конвертации` }, { status: 400 });
  }

  if (amount % rate !== 0) {
    return NextResponse.json({ error: `Количество монет должно быть кратно ${rate}` }, { status: 400 });
  }

  const routiksToAdd = amount / rate;

  // Атомарная конвертация
  const result = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(userId), coins: { $gte: amount } },
    {
      $inc: { coins: -amount, routiks: routiksToAdd },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
  }

  // Логируем транзакцию
  await db.collection("coin_transactions").insertOne({
    userId,
    type: "convert_to_routiks",
    coinsSpent: amount,
    routiksReceived: routiksToAdd,
    rate,
    createdAt: new Date(),
  });

  return NextResponse.json({
    coins: result.coins,
    routiks: result.routiks,
    converted: routiksToAdd,
  });
}
