import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";

// POST /api/friends/accept — принять заявку в друзья
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

  const friendship = await db.collection("friendships").findOne({
    users,
    status: "pending",
    requesterId,
  });

  if (!friendship) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }

  await db.collection("friendships").updateOne(
    { _id: friendship._id },
    { $set: { status: "accepted", acceptedAt: new Date() } }
  );

  // Уведомление отправителю заявки
  await createNotification(requesterId, "friend_accept", {
    userId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
  });

  return NextResponse.json({ ok: true });
}
