import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// PATCH /api/admin/currency/rate — изменить курс валюты
export async function PATCH(request) {
  const { error } = await requirePermission(request, "shop.manage");
  if (error) return error;

  const { rate } = await request.json();

  if (!rate || typeof rate !== "number" || rate < 1 || rate > 1000 || !Number.isInteger(rate)) {
    return NextResponse.json({ error: "Курс должен быть целым числом от 1 до 1000" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("currency_settings").updateOne(
    { key: "exchange_rate" },
    { $set: { value: rate, updatedAt: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ rate });
}
