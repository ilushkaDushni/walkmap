import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/groups/[groupId]/messages/media — все медиа из группового чата
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { groupId } = await params;
  const userId = auth.user._id.toString();

  const db = await getDb();

  // Проверка что юзер — участник группы
  const group = await db.collection("group_chats").findOne({
    _id: new ObjectId(groupId),
    "members.userId": userId,
  });

  if (!group) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const before = searchParams.get("before");

  const filter = { groupId };

  if (type === "image") {
    filter.type = "image";
  } else if (type === "voice") {
    filter.type = "voice";
  } else {
    filter.type = { $in: ["image", "voice"] };
  }

  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const raw = await db.collection("group_messages")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = raw.length > limit;
  const messages = hasMore ? raw.slice(0, limit) : raw;

  // Подтягиваем имена отправителей
  const senderIds = [...new Set(messages.map((m) => m.senderId))];
  const users = senderIds.length > 0
    ? await db.collection("users")
        .find({ _id: { $in: senderIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, username: 1 })
        .toArray()
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.username]));

  const items = messages.map((m) => ({
    id: m._id.toString(),
    type: m.type,
    imageUrl: m.imageUrl || null,
    audioUrl: m.audioUrl || null,
    audioDuration: m.audioDuration || 0,
    senderId: m.senderId,
    senderUsername: userMap[m.senderId] || "Участник",
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ items, hasMore });
}
