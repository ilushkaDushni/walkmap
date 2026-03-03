import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { createAndPushNotification } from "@/lib/notifications";

// POST /api/admin/shop/revoke — изъять предмет у юзера
export async function POST(request) {
  const auth = await requirePermission(request, "shop.manage");
  if (auth.error) return auth.error;

  const adminId = auth.user._id.toString();
  const adminUsername = auth.user.username;

  const { userId, itemId, reason, refundPercent } = await request.json();

  if (!userId || !itemId) {
    return NextResponse.json({ error: "userId и itemId обязательны" }, { status: 400 });
  }
  if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "Причина обязательна" }, { status: 400 });
  }
  if (reason.trim().length > 200) {
    return NextResponse.json({ error: "Причина макс. 200 символов" }, { status: 400 });
  }

  const refund = [0, 50, 100].includes(refundPercent) ? refundPercent : 0;

  const db = await getDb();

  // Найти предмет в инвентаре
  const invItem = await db.collection("user_inventory").findOne({ userId, itemId });
  if (!invItem) {
    return NextResponse.json({ error: "Предмет не найден в инвентаре" }, { status: 404 });
  }

  // Загрузить данные товара
  let shopItem;
  try {
    shopItem = await db.collection("shop_items").findOne({ _id: new ObjectId(itemId) });
  } catch {
    return NextResponse.json({ error: "Неверный itemId" }, { status: 400 });
  }

  if (!shopItem) {
    return NextResponse.json({ error: "Товар не найден в магазине" }, { status: 404 });
  }

  const category = shopItem.category;
  const itemName = shopItem.name;
  const price = shopItem.price || 0;

  // Если предмет equipped — снять
  if (invItem.equipped) {
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $unset: { [`equippedItems.${category}`]: "" } }
    );
  }

  // Удалить из инвентаря
  await db.collection("user_inventory").deleteOne({ userId, itemId });

  // Возврат рутиков
  const refundRoutiks = refund > 0 ? Math.floor(price * refund / 100) : 0;
  if (refundRoutiks > 0) {
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { routiks: refundRoutiks } }
    );
  }

  // Лог транзакции
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { routiks: 1 } }
  );

  await db.collection("coin_transactions").insertOne({
    userId,
    type: "admin_revoke",
    amount: refundRoutiks,
    balance: user?.routiks || 0,
    meta: {
      adminId,
      adminUsername,
      reason: reason.trim(),
      itemId,
      itemName,
      refundRoutiks,
    },
    createdAt: new Date(),
  });

  // Уведомление
  const notifData = {
    itemName,
    reason: reason.trim(),
    refundRoutiks,
    adminUsername,
  };
  await createAndPushNotification(userId, "item_revoke", notifData);

  return NextResponse.json({ ok: true, refundRoutiks });
}
