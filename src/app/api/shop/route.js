import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// GET /api/shop — каталог магазина (публичный)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const skip = (page - 1) * limit;

  const db = await getDb();

  const filter = { isActive: true };
  if (category) {
    filter.category = category;
  }

  const [items, total] = await Promise.all([
    db.collection("shop_items")
      .find(filter)
      .sort({ rarity: 1, price: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection("shop_items").countDocuments(filter),
  ]);

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
    createdAt: item.createdAt,
  }));

  return NextResponse.json({
    items: serialized,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
