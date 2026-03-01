import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { uploadFile } from "@/lib/storage";
import { createNotification } from "@/lib/notifications";
import { pushNotification } from "@/lib/sse";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";
import { resolveUserPermissions } from "@/lib/permissions";
import sharp from "sharp";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// POST /api/messages/[conversationKey]/upload — отправка картинки
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();
  const isAdminConv = isAdminConversationKey(conversationKey);

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
  if (!file) {
    return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Допустимы только JPEG, PNG, WebP" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "Максимум 10 МБ" }, { status: 400 });
  }

  // Конвертируем в WebP, ограничиваем размер
  const buffer = await sharp(Buffer.from(arrayBuffer))
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `chat/${conversationKey}/${userId}_${Date.now()}.webp`;
  const imageUrl = await uploadFile(key, buffer, "image/webp");

  const message = {
    conversationKey,
    senderId: userId,
    text: null,
    type: "image",
    imageUrl,
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
      text: "Отправил фото",
      conversationKey,
      userId,
    };

    const existing = await db.collection("notifications").findOne({
      userId: recipientId,
      type: notifType,
      "data.conversationKey": conversationKey,
      read: false,
    });
    if (!existing) {
      await createNotification(recipientId, notifType, ssePayload);
    }
    pushNotification(recipientId, ssePayload);
  }

  return NextResponse.json({
    id: result.insertedId.toString(),
    senderId: userId,
    text: null,
    type: "image",
    imageUrl,
    routeId: null,
    replyToId: null,
    replyTo: null,
    reactions: [],
    createdAt: message.createdAt,
    editedAt: null,
    readAt: null,
  }, { status: 201 });
}
