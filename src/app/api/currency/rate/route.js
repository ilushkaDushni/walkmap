import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// GET /api/currency/rate — текущий курс (публичный)
export async function GET() {
  const db = await getDb();
  const setting = await db.collection("currency_settings").findOne({ key: "exchange_rate" });
  const rate = setting?.value || 10;
  return NextResponse.json({ rate });
}
