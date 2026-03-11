import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";
import { pushNotification } from "@/lib/sse";

import { resolveUserPermissions } from "@/lib/permissions";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";
import { checkProfanity, checkFlood, sendAutoWarning, notifyModeratorsAboutViolation } from "@/lib/profanity";

// GET /api/messages/[conversationKey] — получить сообщения
export async function GET(request, { params }) {
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
    if (parts.length !== 2 || !parts.includes(userId)) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const before = searchParams.get("before");
  const after = searchParams.get("after");

  const db = await getDb();

  const filter = {
    conversationKey,
    deletedFor: { $ne: userId },
  };
  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  } else if (after) {
    filter.createdAt = { $gt: new Date(after) };
  }

  // Fetch limit+1 to determine hasMore
  const raw = await db.collection("messages")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = raw.length > limit;
  const messages = hasMore ? raw.slice(0, limit) : raw;

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

  // Typing indicators (пигибэк) — только свежие (< 5 сек)
  let typingUsers = [];
  try {
    const typingCutoff = new Date(Date.now() - 5000);
    const typingDocs = await db.collection("typing_indicators")
      .find({ conversationKey, userId: { $ne: userId }, updatedAt: { $gt: typingCutoff } })
      .toArray();
    typingUsers = typingDocs.map((t) => t.userId);
  } catch {
    // коллекция может не существовать
  }

  // Для admin-диалогов подгружаем username отправителей
  let senderUsernameMap = {};
  if (isAdminConv) {
    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    if (senderIds.length > 0) {
      const senders = await db.collection("users")
        .find({ _id: { $in: senderIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, username: 1 })
        .toArray();
      for (const s of senders) {
        senderUsernameMap[s._id.toString()] = s.username;
      }
    }
  }

  const serialized = messages.reverse().map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId,
    text: m.text,
    type: m.type || "text",
    imageUrl: m.imageUrl || null,
    audioUrl: m.audioUrl || null,
    audioDuration: m.audioDuration || 0,
    routeId: m.routeId || null,
    createdAt: m.createdAt,
    editedAt: m.editedAt || null,
    readAt: m.readAt || null,
    replyTo: m.replyToId ? (replyMap[m.replyToId] || null) : null,
    replyToId: m.replyToId || null,
    reactions: m.reactions || [],
    ...(isAdminConv && m.type === "admin" ? { senderUsername: m.senderUsername || senderUsernameMap[m.senderId] || "Админ" } : {}),
  }));

  // Закреплённое сообщение (только при начальной загрузке, без before/after)
  let pinnedMessage = null;
  if (!before && !after) {
    const pinned = await db.collection("messages").findOne(
      { conversationKey, pinnedAt: { $exists: true }, deletedFor: { $ne: userId } },
      { sort: { pinnedAt: -1 } }
    );
    if (pinned) {
      let senderName = "Пользователь";
      try {
        const sender = await db.collection("users").findOne(
          { _id: new ObjectId(pinned.senderId) },
          { projection: { username: 1 } }
        );
        if (sender) senderName = sender.username;
      } catch { /* ignore */ }
      pinnedMessage = {
        id: pinned._id.toString(),
        senderId: pinned.senderId,
        senderName,
        text: pinned.text || null,
        type: pinned.type || "text",
        imageUrl: pinned.imageUrl || null,
        audioUrl: pinned.audioUrl || null,
        createdAt: pinned.createdAt,
        pinnedAt: pinned.pinnedAt,
        pinnedBy: pinned.pinnedBy,
      };
    }
  }

  return NextResponse.json({ messages: serialized, hasMore, typingUsers, pinnedMessage });
}

// POST /api/messages/[conversationKey] — отправить сообщение
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();

  const isAdminConvPost = isAdminConversationKey(conversationKey);
  let isAdminBypass = false;

  if (isAdminConvPost) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    if (userId === targetUserId) {
      // Пользователь отвечает — разрешить
    } else {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      isAdminBypass = true;
    }
  } else {
    const parts = conversationKey.split("_");
    if (parts.length !== 2 || !parts.includes(userId)) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      isAdminBypass = true;
    }
  }

  const { text, routeId, replyToId, adminMode } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length > 1000) {
    return NextResponse.json({ error: "Максимум 1000 символов" }, { status: 400 });
  }

  const db = await getDb();

  // ─── Модерация (пропуск для admin-сообщений и приватных чатов друзей) ───
  // В личных чатах между друзьями модерация не нужна
  const isPrivateChat = !isAdminConvPost && !isAdminBypass;
  if (!isAdminBypass && !isPrivateChat) {
    // Проверка мата
    const { hasProfanity, matchedWords } = checkProfanity(trimmed);
    if (hasProfanity) {
      sendAutoWarning(userId, "Нецензурная лексика", trimmed);
      notifyModeratorsAboutViolation({
        userId,
        username: auth.user.username,
        text: trimmed,
      });
      return NextResponse.json(
        { error: "Сообщение содержит нецензурную лексику" },
        { status: 400 }
      );
    }

    // Проверка флуда (5 сек кулдаун)
    const { isFlooding, retryAfterMs } = checkFlood(userId, 5000);
    if (isFlooding) {
      sendAutoWarning(userId, "Флуд (слишком частые сообщения)");
      return NextResponse.json(
        { error: "Слишком быстро. Подождите немного", retryAfterMs },
        { status: 429 }
      );
    }
  }

  // Если adminMode запрошен — проверяем пермишен
  let isAdminMessage = isAdminBypass;
  if (isAdminConvPost && isAdminBypass) {
    isAdminMessage = true;
  } else if (adminMode) {
    const perms = await resolveUserPermissions(auth.user);
    if (perms.includes("users.view")) {
      isAdminMessage = true;
    }
  }

  if (!isAdminMessage && !isAdminConvPost) {
    const parts = conversationKey.split("_");
    const friendship = await db.collection("friendships").findOne({
      users: { $all: parts },
      status: "accepted",
    });

    if (!friendship) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Можно писать только друзьям" }, { status: 403 });
      }
      isAdminMessage = true;
    }
  }

  const message = {
    conversationKey,
    senderId: userId,
    text: trimmed,
    type: isAdminMessage ? "admin" : "text",
    routeId: routeId || null,
    replyToId: replyToId || null,
    reactions: [],
    deletedFor: [],
    createdAt: new Date(),
    readAt: null,
  };

  const result = await db.collection("messages").insertOne(message);

  // Убираем typing indicator после отправки
  try {
    await db.collection("typing_indicators").deleteOne({ conversationKey, userId });
  } catch { /* ignore */ }

  // Обновляем lastActivityAt
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { lastActivityAt: new Date() } }
  );

  // Уведомление + SSE получателю
  let recipientId;
  if (isAdminConvPost) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    // Если пишет админ — получатель пользователь, если пользователь — уведомлять не нужно (админы сами увидят)
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

    const notifType = isAdminConvPost && isAdminMessage ? "admin_message" : "new_message";
    const ssePayload = {
      type: notifType,
      username: isAdminConvPost && isAdminMessage ? "Администрация" : (sender?.username || "Кто-то"),
      adminUsername: isAdminMessage ? (sender?.username || "Админ") : undefined,
      avatarUrl: isAdminConvPost && isAdminMessage ? null : (sender?.avatarUrl || null),
      text: trimmed.slice(0, 100),
      conversationKey,
      userId,
    };

    // Дедупликация уведомлений в БД
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

    // SSE — всегда пушим для мгновенного тоста (с notificationId для дедупликации)
    pushNotification(recipientId, { ...ssePayload, notificationId });
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

  const response = {
    id: result.insertedId.toString(),
    senderId: userId,
    text: trimmed,
    type: message.type,
    imageUrl: null,
    routeId: message.routeId,
    replyToId: message.replyToId,
    replyTo,
    reactions: [],
    createdAt: message.createdAt,
    editedAt: null,
    readAt: null,
  };

  // Добавляем senderUsername для admin-сообщений
  if (isAdminConvPost && isAdminMessage) {
    const senderDoc = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { username: 1 } }
    );
    response.senderUsername = senderDoc?.username || "Админ";
  }

  return NextResponse.json(response, { status: 201 });
}
