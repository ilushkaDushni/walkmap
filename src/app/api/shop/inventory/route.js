import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/shop/inventory — инвентарь текущего юзера
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const db = await getDb();

  const inventory = await db.collection("user_inventory")
    .find({ userId })
    .sort({ acquiredAt: -1 })
    .toArray();

  if (inventory.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Подгружаем данные товаров
  const itemIds = inventory.map((inv) => {
    try { return new ObjectId(inv.itemId); } catch { return null; }
  }).filter(Boolean);

  const shopItems = await db.collection("shop_items")
    .find({ _id: { $in: itemIds } })
    .toArray();

  const itemMap = Object.fromEntries(shopItems.map((i) => [i._id.toString(), i]));

  const result = inventory.map((inv) => {
    const item = itemMap[inv.itemId];
    if (!item) return null;
    return {
      id: inv.itemId,
      name: item.name,
      slug: item.slug,
      category: item.category,
      description: item.description || "",
      imageUrl: item.imageUrl || null,
      rarity: item.rarity || "common",
      cssData: item.cssData || {},
      equipped: inv.equipped,
      acquiredAt: inv.acquiredAt,
    };
  }).filter(Boolean);

  return NextResponse.json({ items: result });
}
