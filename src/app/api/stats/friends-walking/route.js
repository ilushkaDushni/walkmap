import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/stats/friends-walking — друзья, активные за последние 30 минут
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    // Получаем друзей
    const friendships = await db.collection("friendships")
      .find({ users: userId, status: "accepted" })
      .toArray();
    const friendIds = friendships.flatMap((f) => f.users.filter((id) => id !== userId));

    if (friendIds.length === 0) {
      return NextResponse.json({ friends: [] });
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const activeUsers = await db.collection("users")
      .find({
        _id: { $in: friendIds.map((id) => new ObjectId(id)) },
        lastActivityAt: { $gt: thirtyMinAgo },
      })
      .project({ _id: 1, username: 1, avatarUrl: 1, lastActivityAt: 1, equippedItems: 1 })
      .sort({ lastActivityAt: -1 })
      .limit(20)
      .toArray();

    const friends = activeUsers.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      avatarUrl: u.avatarUrl || null,
      lastActivityAt: u.lastActivityAt,
      equippedItems: u.equippedItems || {},
    }));

    return NextResponse.json({ friends });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
