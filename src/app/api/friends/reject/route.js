import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/friends/reject — отклонить заявку
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { requesterId } = await request.json();

  if (!requesterId || !ObjectId.isValid(requesterId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const userId = auth.user._id.toString();
  const users = [userId, requesterId].sort();
  const db = await getDb();

  const result = await db.collection("friendships").deleteOne({
    users,
    status: "pending",
    requesterId,
  });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
