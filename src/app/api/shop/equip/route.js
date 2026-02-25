import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/shop/equip — надеть/снять предмет
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const { itemId, equip } = await request.json(); // equip: true = надеть, false = снять

  if (!itemId) {
    return NextResponse.json({ error: "itemId обязателен" }, { status: 400 });
  }

  const db = await getDb();

  // Проверяем что предмет в инвентаре
  const invItem = await db.collection("user_inventory").findOne({ userId, itemId });
  if (!invItem) {
    return NextResponse.json({ error: "Предмет не в инвентаре" }, { status: 404 });
  }

  let oid;
  try {
    oid = new ObjectId(itemId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const shopItem = await db.collection("shop_items").findOne({ _id: oid });
  if (!shopItem) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  const category = shopItem.category;

  if (equip) {
    // Снимаем предыдущий предмет в этой категории
    const currentlyEquipped = await db.collection("user_inventory").find({
      userId,
      equipped: true,
    }).toArray();

    // Проверяем через shop_items какие из них в той же категории
    for (const eq of currentlyEquipped) {
      if (eq.itemId === itemId) continue;
      try {
        const eqItem = await db.collection("shop_items").findOne({ _id: new ObjectId(eq.itemId) });
        if (eqItem && eqItem.category === category) {
          await db.collection("user_inventory").updateOne(
            { userId, itemId: eq.itemId },
            { $set: { equipped: false } }
          );
        }
      } catch { /* ignore */ }
    }

    // Надеваем
    await db.collection("user_inventory").updateOne(
      { userId, itemId },
      { $set: { equipped: true } }
    );

    // Обновляем equippedItems на юзере (денормализация)
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: {
        [`equippedItems.${category}`]: {
          slug: shopItem.slug,
          name: shopItem.name,
          cssData: shopItem.cssData || {},
          imageUrl: shopItem.imageUrl || null,
        }
      }}
    );
  } else {
    // Снимаем
    await db.collection("user_inventory").updateOne(
      { userId, itemId },
      { $set: { equipped: false } }
    );

    // Убираем из equippedItems
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $unset: { [`equippedItems.${category}`]: "" } }
    );
  }

  // Возвращаем обновлённые equippedItems
  const updatedUser = await db.collection("users").findOne({ _id: new ObjectId(userId) });

  return NextResponse.json({
    equippedItems: updatedUser.equippedItems || {},
  });
}
