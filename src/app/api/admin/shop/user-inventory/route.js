import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/shop/user-inventory?userId=X — инвентарь любого юзера
export async function GET(request) {
  const auth = await requirePermission(request, "shop.manage");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  }

  const db = await getDb();

  const inventory = await db.collection("user_inventory")
    .find({ userId })
    .sort({ acquiredAt: -1 })
    .toArray();

  if (inventory.length === 0) {
    return NextResponse.json({ items: [] });
  }

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
      price: item.price || 0,
      cssData: item.cssData || {},
      equipped: inv.equipped,
      acquiredAt: inv.acquiredAt,
    };
  }).filter(Boolean);

  return NextResponse.json({ items: result });
}
