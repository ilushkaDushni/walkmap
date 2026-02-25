import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/shop/buy — покупка предмета
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const { itemId } = await request.json();

  if (!itemId) {
    return NextResponse.json({ error: "itemId обязателен" }, { status: 400 });
  }

  const db = await getDb();

  let oid;
  try {
    oid = new ObjectId(itemId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const item = await db.collection("shop_items").findOne({ _id: oid, isActive: true });
  if (!item) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  // Проверяем что ещё не куплен
  const existing = await db.collection("user_inventory").findOne({ userId, itemId });
  if (existing) {
    return NextResponse.json({ error: "Уже куплен" }, { status: 400 });
  }

  // Атомарное списание маршрутиков
  const result = await db.collection("users").findOneAndUpdate(
    { _id: new ObjectId(userId), routiks: { $gte: item.price } },
    { $inc: { routiks: -item.price } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Недостаточно маршрутиков" }, { status: 400 });
  }

  // Добавляем в инвентарь
  await db.collection("user_inventory").insertOne({
    userId,
    itemId,
    acquiredAt: new Date(),
    equipped: false,
  });

  // Лог транзакции
  await db.collection("coin_transactions").insertOne({
    userId,
    type: "shop_purchase",
    itemId,
    itemName: item.name,
    routiksSpent: item.price,
    createdAt: new Date(),
  });

  return NextResponse.json({
    routiks: result.routiks,
    item: {
      id: item._id.toString(),
      name: item.name,
      slug: item.slug,
      category: item.category,
    },
  });
}
