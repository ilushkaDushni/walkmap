import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/friends/search?q=username — поиск пользователей
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();

  // Поиск по username (регистронезависимый, начало строки)
  const users = await db.collection("users")
    .find({
      username: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, $options: "i" },
      _id: { $ne: auth.user._id },
      banned: { $ne: true },
    })
    .project({ username: 1, avatarUrl: 1, bio: 1 })
    .limit(20)
    .toArray();

  // Проверяем статус дружбы для каждого
  const userIds = users.map((u) => u._id.toString());
  const friendships = await db.collection("friendships")
    .find({
      users: userId,
      $or: userIds.map((uid) => ({ users: uid })),
    })
    .toArray();

  const friendshipMap = {};
  for (const f of friendships) {
    const otherId = f.users.find((u) => u !== userId);
    if (otherId) {
      friendshipMap[otherId] = {
        status: f.status,
        requesterId: f.requesterId,
      };
    }
  }

  const serialized = users.map((u) => {
    const uid = u._id.toString();
    const friendship = friendshipMap[uid];
    let friendStatus = "none";
    if (friendship) {
      if (friendship.status === "accepted") friendStatus = "friend";
      else if (friendship.requesterId === userId) friendStatus = "pending_sent";
      else friendStatus = "pending_received";
    }

    return {
      id: uid,
      username: u.username,
      avatarUrl: u.avatarUrl || null,
      bio: u.bio || "",
      friendStatus,
    };
  });

  return NextResponse.json({ users: serialized });
}
