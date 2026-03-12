import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/groups/[groupId]/media — получить медиа из чата (фото, аудио)
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { groupId } = await params;
  const userId = auth.user._id.toString();
  const db = await getDb();

  const group = await db.collection("group_chats").findOne({
    _id: new ObjectId(groupId),
    "members.userId": userId,
  });
  if (!group) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "image"; // "image" | "voice" | "link"
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const before = searchParams.get("before");

  const filter = { groupId };

  if (type === "image") {
    filter.type = "image";
    filter.imageUrl = { $exists: true, $ne: null };
  } else if (type === "voice") {
    filter.type = "voice";
    filter.audioUrl = { $exists: true, $ne: null };
  } else if (type === "link") {
    filter.text = { $regex: /https?:\/\//, $options: "i" };
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
  const items = (hasMore ? raw.slice(0, limit) : raw).map((m) => ({
    id: m._id.toString(),
    type: m.type || "text",
    imageUrl: m.imageUrl || null,
    audioUrl: m.audioUrl || null,
    audioDuration: m.audioDuration || 0,
    text: m.text || null,
    senderId: m.senderId,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ items, hasMore });
}
