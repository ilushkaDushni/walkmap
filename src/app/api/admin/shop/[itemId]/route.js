import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission, requireAnyPermission } from "@/lib/adminAuth";

// PATCH /api/admin/shop/[itemId] — обновить товар
export async function PATCH(request, { params }) {
  const { error, permissions } = await requireAnyPermission(request, "shop.manage", "shop.edit");
  if (error) return error;

  const hasFullManage = permissions.includes("shop.manage");

  const { itemId } = await params;
  let oid;
  try {
    oid = new ObjectId(itemId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const body = await request.json();
  const allowed = hasFullManage
    ? ["name", "description", "price", "imageUrl", "rarity", "cssData", "isActive", "category"]
    : ["price", "rarity", "isActive"];
  const update = {};

  for (const key of allowed) {
    if (body[key] !== undefined) {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  update.updatedAt = new Date();

  const db = await getDb();
  const result = await db.collection("shop_items").findOneAndUpdate(
    { _id: oid },
    { $set: update },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  return NextResponse.json({
    id: result._id.toString(),
    name: result.name,
    slug: result.slug,
    category: result.category,
    description: result.description || "",
    price: result.price,
    imageUrl: result.imageUrl || null,
    rarity: result.rarity || "common",
    cssData: result.cssData || {},
    isActive: result.isActive,
  });
}

// DELETE /api/admin/shop/[itemId] — деактивировать товар
export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, "shop.manage");
  if (error) return error;

  const { itemId } = await params;
  let oid;
  try {
    oid = new ObjectId(itemId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("shop_items").updateOne(
    { _id: oid },
    { $set: { isActive: false, updatedAt: new Date() } }
  );

  return NextResponse.json({ deactivated: true });
}
