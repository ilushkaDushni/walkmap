import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/tickets/unread-count — количество открытых тикетов
export async function GET(request) {
  const { error } = await requirePermission(request, "feedback.manage");
  if (error) return error;

  const db = await getDb();
  const count = await db.collection("tickets").countDocuments({ status: "open" });

  return NextResponse.json({ count });
}
