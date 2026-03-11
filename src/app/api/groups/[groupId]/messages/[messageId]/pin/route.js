import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// PATCH /api/groups/[groupId]/messages/[messageId]/pin — toggle pin
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { groupId, messageId } = await params;
  const userId = auth.user._id.toString();
  const db = await getDb();

  // Проверяем членство в группе
  const group = await db.collection("group_chats").findOne({
    _id: new ObjectId(groupId),
    "members.userId": userId,
  });
  if (!group) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  let oid;
  try {
    oid = new ObjectId(messageId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const message = await db.collection("group_messages").findOne({ _id: oid, groupId });
  if (!message) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }

  const isPinned = !!message.pinnedAt;

  if (isPinned) {
    await db.collection("group_messages").updateOne(
      { _id: oid },
      { $unset: { pinnedAt: "", pinnedBy: "" } }
    );
    return NextResponse.json({ pinned: false, pinnedMessage: null });
  } else {
    // Открепить предыдущее
    await db.collection("group_messages").updateMany(
      { groupId, pinnedAt: { $exists: true } },
      { $unset: { pinnedAt: "", pinnedBy: "" } }
    );
    const now = new Date();
    await db.collection("group_messages").updateOne(
      { _id: oid },
      { $set: { pinnedAt: now, pinnedBy: userId } }
    );

    let senderName = "Пользователь";
    try {
      const sender = await db.collection("users").findOne(
        { _id: new ObjectId(message.senderId) },
        { projection: { username: 1 } }
      );
      if (sender) senderName = sender.username;
    } catch { /* ignore */ }

    return NextResponse.json({
      pinned: true,
      pinnedMessage: {
        id: message._id.toString(),
        senderId: message.senderId,
        senderName,
        text: message.text || null,
        type: message.type || "text",
        createdAt: message.createdAt,
        pinnedAt: now,
        pinnedBy: userId,
      },
    });
  }
}
