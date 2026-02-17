import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/friends — список друзей текущего юзера
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();
  const userId = auth.user._id.toString();

  const friendships = await db.collection("friendships")
    .find({ users: userId, status: "accepted" })
    .sort({ acceptedAt: -1 })
    .toArray();

  // Собираем ID друзей
  const friendIds = friendships.map((f) => {
    return f.users.find((u) => u !== userId);
  });

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Загружаем данные друзей
  const { ObjectId } = await import("mongodb");
  const friends = await db.collection("users")
    .find({ _id: { $in: friendIds.map((id) => new ObjectId(id)) } })
    .project({ username: 1, avatarUrl: 1, bio: 1, coins: 1, lastActivityAt: 1 })
    .toArray();

  const serialized = friends.map((f) => ({
    id: f._id.toString(),
    username: f.username,
    avatarUrl: f.avatarUrl || null,
    bio: f.bio || "",
    lastActivityAt: f.lastActivityAt || null,
  }));

  return NextResponse.json({ friends: serialized });
}
