import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";

// POST /api/admin/shop/gift — подарить предмет юзеру
export async function POST(request) {
  const auth = await requirePermission(request, "shop.manage");
  if (auth.error) return auth.error;

  const adminId = auth.user._id.toString();
  const adminUsername = auth.user.username;

  const { userId, itemId, message } = await request.json();

  if (!userId || !itemId) {
    return NextResponse.json({ error: "userId и itemId обязательны" }, { status: 400 });
  }

  const db = await getDb();

  // Проверить что предмет существует
  let shopItem;
  try {
    shopItem = await db.collection("shop_items").findOne({ _id: new ObjectId(itemId) });
  } catch {
    return NextResponse.json({ error: "Неверный itemId" }, { status: 400 });
  }

  if (!shopItem) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  // Проверить что юзер НЕ владеет этим предметом
  const existing = await db.collection("user_inventory").findOne({ userId, itemId });
  if (existing) {
    return NextResponse.json({ error: "Пользователь уже владеет этим предметом" }, { status: 409 });
  }

  // Добавить в инвентарь
  await db.collection("user_inventory").insertOne({
    userId,
    itemId,
    acquiredAt: new Date(),
    equipped: false,
  });

  const trimmedMessage = message ? String(message).trim().slice(0, 200) : "";

  // Лог транзакции
  await db.collection("coin_transactions").insertOne({
    userId,
    type: "admin_gift",
    amount: 0,
    balance: 0,
    meta: {
      adminId,
      adminUsername,
      itemId,
      itemName: shopItem.name,
      message: trimmedMessage,
    },
    createdAt: new Date(),
  });

  // Уведомление
  await createNotification(userId, "item_gift", {
    itemName: shopItem.name,
    adminUsername,
    message: trimmedMessage,
  });

  return NextResponse.json({ ok: true });
}
