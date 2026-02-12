import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// DELETE /api/friends/[id] — удалить из друзей
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id: friendId } = await params;

  if (!ObjectId.isValid(friendId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const userId = auth.user._id.toString();
  const users = [userId, friendId].sort();
  const db = await getDb();

  const result = await db.collection("friendships").deleteOne({ users });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Дружба не найдена" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
