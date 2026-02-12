import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/friends/pending — входящие заявки в друзья
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();
  const userId = auth.user._id.toString();

  // Заявки, где текущий юзер НЕ отправитель
  const pending = await db.collection("friendships")
    .find({ users: userId, status: "pending", requesterId: { $ne: userId } })
    .sort({ createdAt: -1 })
    .toArray();

  if (pending.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  const requesterIds = pending.map((p) => new ObjectId(p.requesterId));
  const users = await db.collection("users")
    .find({ _id: { $in: requesterIds } })
    .project({ username: 1, avatarUrl: 1, bio: 1 })
    .toArray();

  const userMap = {};
  for (const u of users) {
    userMap[u._id.toString()] = u;
  }

  const serialized = pending.map((p) => {
    const u = userMap[p.requesterId] || {};
    return {
      id: p.requesterId,
      username: u.username || "???",
      avatarUrl: u.avatarUrl || null,
      bio: u.bio || "",
      createdAt: p.createdAt,
    };
  });

  return NextResponse.json({ requests: serialized });
}
