import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { uploadFile } from "@/lib/storage";
import { createNotification } from "@/lib/notifications";
import { pushNotification } from "@/lib/sse";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";
import { resolveUserPermissions } from "@/lib/permissions";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

// POST /api/messages/[conversationKey]/upload-audio — отправка голосового сообщения
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();
  const isAdminConv = isAdminConversationKey(conversationKey);

  // Проверка доступа
  if (isAdminConv) {
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

    const db = await getDb();
    const friendship = await db.collection("friendships").findOne({
      users: { $all: parts },
      status: "accepted",
    });
    if (!friendship) {
      return NextResponse.json({ error: "Можно писать только друзьям" }, { status: 403 });
    }
  }

  const db = await getDb();

  const formData = await request.formData();
  const file = formData.get("file");
  const duration = parseInt(formData.get("duration") || "0", 10);

  if (!file) {
    return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Недопустимый формат аудио" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "Максимум 15 МБ" }, { status: 400 });
  }

  const ext = file.type.includes("webm") ? "webm" : file.type.includes("ogg") ? "ogg" : "m4a";
  const key = `chat/${conversationKey}/voice_${userId}_${Date.now()}.${ext}`;
  const audioUrl = await uploadFile(key, Buffer.from(arrayBuffer), file.type);

  const message = {
    conversationKey,
    senderId: userId,
    text: null,
    type: "voice",
    audioUrl,
    audioDuration: duration || 0,
    imageUrl: null,
    routeId: null,
    replyToId: null,
    reactions: [],
    deletedFor: [],
    createdAt: new Date(),
    readAt: null,
  };

  const result = await db.collection("messages").insertOne(message);

  // Обновляем lastActivityAt
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { lastActivityAt: new Date() } }
  );

  // Уведомление получателю
  let recipientId;
  if (isAdminConv) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    recipientId = userId !== targetUserId ? targetUserId : null;
  } else {
    const parts = conversationKey.split("_");
    recipientId = parts.find((p) => p !== userId);
  }

  if (recipientId) {
    const sender = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { username: 1, avatarUrl: 1 } }
    );
    const notifType = isAdminConv ? "admin_message" : "new_message";
    const ssePayload = {
      type: notifType,
      username: isAdminConv ? "Администрация" : (sender?.username || "Кто-то"),
      avatarUrl: isAdminConv ? null : (sender?.avatarUrl || null),
      text: "Голосовое сообщение",
      conversationKey,
      userId,
    };

    const existing = await db.collection("notifications").findOne({
      userId: recipientId,
      type: notifType,
      "data.conversationKey": conversationKey,
      read: false,
    });
    let notificationId;
    if (!existing) {
      notificationId = await createNotification(recipientId, notifType, ssePayload);
    } else {
      notificationId = existing._id.toString();
    }
    pushNotification(recipientId, { ...ssePayload, notificationId });
  }

  return NextResponse.json({
    id: result.insertedId.toString(),
    senderId: userId,
    text: null,
    type: "voice",
    audioUrl,
    audioDuration: message.audioDuration,
    imageUrl: null,
    routeId: null,
    replyToId: null,
    replyTo: null,
    reactions: [],
    createdAt: message.createdAt,
    editedAt: null,
    readAt: null,
  }, { status: 201 });
}
