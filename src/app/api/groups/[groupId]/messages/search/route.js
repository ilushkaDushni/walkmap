import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/groups/[groupId]/messages/search?q=текст
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group || !group.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Минимум 2 символа" }, { status: 400 });
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const raw = await db.collection("group_messages")
      .find({
        groupId,
        text: { $regex: escapedQuery, $options: "i" },
        deletedFor: { $nin: [userId] },
      })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    const senderIds = [...new Set(raw.map((m) => m.senderId))];
    const users = senderIds.length > 0
      ? await db.collection("users")
          .find({ _id: { $in: senderIds.map((id) => new ObjectId(id)) } })
          .project({ _id: 1, username: 1, avatarUrl: 1 })
          .toArray()
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const results = raw.map((m) => {
      const sender = userMap[m.senderId];
      return {
        id: m._id.toString(),
        senderId: m.senderId,
        senderUsername: sender?.username || "Удалён",
        text: m.text,
        createdAt: m.createdAt,
      };
    });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
