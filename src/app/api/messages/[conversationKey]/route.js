import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";
import { pushNotification } from "@/lib/sse";

// GET /api/messages/[conversationKey] — получить сообщения
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const before = searchParams.get("before");

  const db = await getDb();

  const filter = {
    conversationKey,
    deletedFor: { $ne: userId },
  };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const messages = await db.collection("messages")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  // Собираем replyToId для подгрузки оригиналов
  const replyIds = messages
    .filter((m) => m.replyToId)
    .map((m) => m.replyToId);

  let replyMap = {};
  if (replyIds.length > 0) {
    const originals = await db.collection("messages")
      .find({ _id: { $in: replyIds.map((id) => new ObjectId(id)) } })
      .project({ _id: 1, senderId: 1, text: 1 })
      .toArray();

    // Подгружаем username отправителей оригиналов
    const senderIds = [...new Set(originals.map((o) => o.senderId))];
    const senders = await db.collection("users")
      .find({ _id: { $in: senderIds.map((id) => new ObjectId(id)) } })
      .project({ _id: 1, username: 1 })
      .toArray();
    const senderMap = Object.fromEntries(senders.map((s) => [s._id.toString(), s.username]));

    for (const o of originals) {
      replyMap[o._id.toString()] = {
        senderId: o.senderId,
        senderName: senderMap[o.senderId] || "Удалённый",
        text: o.text?.slice(0, 100) || "",
      };
    }
  }

  const serialized = messages.reverse().map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId,
    text: m.text,
    routeId: m.routeId || null,
    createdAt: m.createdAt,
    readAt: m.readAt || null,
    replyTo: m.replyToId ? (replyMap[m.replyToId] || null) : null,
    replyToId: m.replyToId || null,
    reactions: m.reactions || [],
  }));

  return NextResponse.json({ messages: serialized });
}

// POST /api/messages/[conversationKey] — отправить сообщение
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { text, routeId, replyToId } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length > 1000) {
    return NextResponse.json({ error: "Максимум 1000 символов" }, { status: 400 });
  }

  const db = await getDb();
  const friendship = await db.collection("friendships").findOne({
    users: { $all: parts },
    status: "accepted",
  });

  if (!friendship) {
    return NextResponse.json({ error: "Можно писать только друзьям" }, { status: 403 });
  }

  const message = {
    conversationKey,
    senderId: userId,
    text: trimmed,
    routeId: routeId || null,
    replyToId: replyToId || null,
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

  // Уведомление + SSE получателю
  const recipientId = parts.find((p) => p !== userId);
  if (recipientId) {
    const sender = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { username: 1, avatarUrl: 1 } }
    );
    const ssePayload = {
      type: "new_message",
      username: sender?.username || "Кто-то",
      avatarUrl: sender?.avatarUrl || null,
      text: trimmed.slice(0, 100),
      conversationKey,
      userId,
    };

    // Дедупликация уведомлений в БД
    const existing = await db.collection("notifications").findOne({
      userId: recipientId,
      type: "new_message",
      "data.userId": userId,
      read: false,
    });
    if (!existing) {
      await createNotification(recipientId, "new_message", ssePayload);
    }

    // SSE — всегда пушим для мгновенного тоста
    pushNotification(recipientId, ssePayload);
  }

  // Подгружаем replyTo если есть
  let replyTo = null;
  if (replyToId) {
    try {
      const orig = await db.collection("messages").findOne({ _id: new ObjectId(replyToId) });
      if (orig) {
        const sender = await db.collection("users").findOne(
          { _id: new ObjectId(orig.senderId) },
          { projection: { username: 1 } }
        );
        replyTo = {
          senderId: orig.senderId,
          senderName: sender?.username || "Удалённый",
          text: orig.text?.slice(0, 100) || "",
        };
      }
    } catch { /* ignore invalid id */ }
  }

  return NextResponse.json({
    id: result.insertedId.toString(),
    senderId: userId,
    text: trimmed,
    routeId: message.routeId,
    replyToId: message.replyToId,
    replyTo,
    reactions: [],
    createdAt: message.createdAt,
    readAt: null,
  }, { status: 201 });
}
