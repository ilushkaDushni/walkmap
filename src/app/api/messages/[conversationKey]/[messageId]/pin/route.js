import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";
import { resolveUserPermissions } from "@/lib/permissions";

// PATCH /api/messages/[conversationKey]/[messageId]/pin — toggle pin
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey, messageId } = await params;
  const userId = auth.user._id.toString();

  // Проверка доступа
  if (isAdminConversationKey(conversationKey)) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    if (userId !== targetUserId) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
    }
  } else {
    const parts = conversationKey.split("_");
    if (!parts.includes(userId)) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
  }

  const db = await getDb();
  let oid;
  try {
    oid = new ObjectId(messageId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const message = await db.collection("messages").findOne({ _id: oid, conversationKey });
  if (!message) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }

  const isPinned = !!message.pinnedAt;

  if (isPinned) {
    // Открепить
    await db.collection("messages").updateOne(
      { _id: oid },
      { $unset: { pinnedAt: "", pinnedBy: "" } }
    );
    return NextResponse.json({ pinned: false, pinnedMessage: null });
  } else {
    // Открепить предыдущее закреплённое в этом диалоге
    await db.collection("messages").updateMany(
      { conversationKey, pinnedAt: { $exists: true } },
      { $unset: { pinnedAt: "", pinnedBy: "" } }
    );
    // Закрепить новое
    const now = new Date();
    await db.collection("messages").updateOne(
      { _id: oid },
      { $set: { pinnedAt: now, pinnedBy: userId } }
    );

    // Подгрузить username отправителя для ответа
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
        imageUrl: message.imageUrl || null,
        audioUrl: message.audioUrl || null,
        createdAt: message.createdAt,
        pinnedAt: now,
        pinnedBy: userId,
      },
    });
  }
}
