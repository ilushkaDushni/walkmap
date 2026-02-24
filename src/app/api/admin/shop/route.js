import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission, requireAnyPermission } from "@/lib/adminAuth";

// GET /api/admin/shop — все товары (включая неактивные)
export async function GET(request) {
  const { error } = await requireAnyPermission(request, "shop.manage", "shop.edit");
  if (error) return error;

  const db = await getDb();
  const items = await db.collection("shop_items")
    .find({})
    .sort({ category: 1, createdAt: -1 })
    .toArray();

  const serialized = items.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    slug: item.slug,
    category: item.category,
    description: item.description || "",
    price: item.price,
    imageUrl: item.imageUrl || null,
    rarity: item.rarity || "common",
    cssData: item.cssData || {},
    isActive: item.isActive,
    createdAt: item.createdAt,
  }));

  return NextResponse.json({ items: serialized });
}

// POST /api/admin/shop — создать товар
export async function POST(request) {
  const { error } = await requirePermission(request, "shop.manage");
  if (error) return error;

  const body = await request.json();
  const { name, slug, category, description, price, imageUrl, rarity, cssData } = body;

  if (!name || !slug || !category || price == null) {
    return NextResponse.json({ error: "name, slug, category, price обязательны" }, { status: 400 });
  }

  const validCategories = ["frame", "banner", "title", "usernameColor", "chatTheme", "appTheme"];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: `Категория должна быть одной из: ${validCategories.join(", ")}` }, { status: 400 });
  }

  const validRarities = ["common", "rare", "epic", "legendary"];
  if (rarity && !validRarities.includes(rarity)) {
    return NextResponse.json({ error: `Редкость должна быть одной из: ${validRarities.join(", ")}` }, { status: 400 });
  }

  if (typeof price !== "number" || price < 0) {
    return NextResponse.json({ error: "Цена должна быть неотрицательным числом" }, { status: 400 });
  }

  const db = await getDb();

  // Проверяем уникальность slug
  const existing = await db.collection("shop_items").findOne({ slug });
  if (existing) {
    return NextResponse.json({ error: "Slug уже занят" }, { status: 400 });
  }

  const item = {
    name,
    slug,
    category,
    description: description || "",
    price,
    imageUrl: imageUrl || null,
    rarity: rarity || "common",
    cssData: cssData || {},
    isActive: true,
    createdAt: new Date(),
  };

  const result = await db.collection("shop_items").insertOne(item);

  return NextResponse.json({
    id: result.insertedId.toString(),
    ...item,
  }, { status: 201 });
}
