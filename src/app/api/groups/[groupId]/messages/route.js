import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { pushNotification } from "@/lib/sse";

// GET /api/groups/[groupId]/messages — получить сообщения группы
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const before = searchParams.get("before");
    const after = searchParams.get("after");

    const filter = { groupId };
    if (before) filter.createdAt = { $lt: new Date(before) };
    else if (after) filter.createdAt = { $gt: new Date(after) };

    const raw = await db.collection("group_messages")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = raw.length > limit;
    const messages = hasMore ? raw.slice(0, limit) : raw;

    // Подгружаем юзеров
    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const users = senderIds.length > 0
      ? await db.collection("users")
          .find({ _id: { $in: senderIds.map((id) => new ObjectId(id)) } })
          .project({ _id: 1, username: 1, avatarUrl: 1, equippedItems: 1 })
          .toArray()
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    // Собираем replyToId для подгрузки оригиналов
    const replyIds = messages
      .filter((m) => m.replyToId)
      .map((m) => m.replyToId);

    let replyMap = {};
    if (replyIds.length > 0) {
      const originals = await db.collection("group_messages")
        .find({ _id: { $in: replyIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, senderId: 1, text: 1 })
        .toArray();

      // Подгружаем username отправителей оригиналов
      const replySenderIds = [...new Set(originals.map((o) => o.senderId))];
      const replySenders = await db.collection("users")
        .find({ _id: { $in: replySenderIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, username: 1 })
        .toArray();
      const replySenderMap = Object.fromEntries(replySenders.map((s) => [s._id.toString(), s.username]));

      for (const o of originals) {
        replyMap[o._id.toString()] = {
          senderId: o.senderId,
          senderName: replySenderMap[o.senderId] || "Удалённый",
          text: o.text?.slice(0, 100) || "",
        };
      }
    }

    const serialized = messages.reverse().map((m) => {
      const sender = userMap[m.senderId];
      return {
        id: m._id.toString(),
        senderId: m.senderId,
        senderUsername: sender?.username || "Удалён",
        senderAvatarUrl: sender?.avatarUrl || null,
        senderEquippedItems: sender?.equippedItems || {},
        text: m.text,
        type: m.type || "text",
        imageUrl: m.imageUrl || null,
        audioUrl: m.audioUrl || null,
        audioDuration: m.audioDuration || 0,
        location: m.location || null,
        replyToId: m.replyToId || null,
        replyTo: m.replyToId ? (replyMap[m.replyToId] || null) : null,
        createdAt: m.createdAt,
        reactions: m.reactions || [],
      };
    });

    // Закреплённое сообщение (при начальной загрузке)
    let pinnedMessage = null;
    if (!before && !after) {
      const pinned = await db.collection("group_messages").findOne(
        { groupId, pinnedAt: { $exists: true } },
        { sort: { pinnedAt: -1 } }
      );
      if (pinned) {
        const pinSender = userMap[pinned.senderId];
        pinnedMessage = {
          id: pinned._id.toString(),
          senderId: pinned.senderId,
          senderName: pinSender?.username || "Пользователь",
          text: pinned.text || null,
          type: pinned.type || "text",
          createdAt: pinned.createdAt,
          pinnedAt: pinned.pinnedAt,
          pinnedBy: pinned.pinnedBy,
        };
      }
    }

    return NextResponse.json({ messages: serialized, hasMore, pinnedMessage });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST /api/groups/[groupId]/messages — отправить сообщение в группу
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();
    const body = await request.json();
    const { text, replyToId, location } = body;

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group || !group.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const sender = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { username: 1, avatarUrl: 1, equippedItems: 1 } }
    );

    // Геолокация
    if (location && location.lat != null && location.lng != null) {
      const locMessage = {
        groupId,
        senderId: userId,
        text: null,
        type: "location",
        location: { lat: Number(location.lat), lng: Number(location.lng) },
        replyToId: replyToId || null,
        reactions: [],
        createdAt: new Date(),
      };

      const locResult = await db.collection("group_messages").insertOne(locMessage);

      await db.collection("group_chats").updateOne(
        { _id: new ObjectId(groupId) },
        {
          $set: {
            lastMessage: { text: "📍 Геолокация", senderId: userId, senderUsername: sender?.username, createdAt: locMessage.createdAt },
            updatedAt: new Date(),
          },
        }
      );

      for (const member of group.members) {
        if (member.userId === userId) continue;
        pushNotification(member.userId, {
          type: "group_message",
          groupId,
          groupName: group.name,
          username: sender?.username || "Кто-то",
          text: "📍 Геолокация",
        });
      }

      return NextResponse.json({
        id: locResult.insertedId.toString(),
        senderId: userId,
        senderUsername: sender?.username || "Вы",
        senderAvatarUrl: sender?.avatarUrl || null,
        senderEquippedItems: sender?.equippedItems || {},
        text: null,
        type: "location",
        location: locMessage.location,
        imageUrl: null,
        audioUrl: null,
        audioDuration: 0,
        replyToId: locMessage.replyToId,
        replyTo: null,
        createdAt: locMessage.createdAt,
        reactions: [],
      }, { status: 201 });
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
    }
    if (text.trim().length > 1000) {
      return NextResponse.json({ error: "Максимум 1000 символов" }, { status: 400 });
    }

    const message = {
      groupId,
      senderId: userId,
      text: text.trim(),
      type: "text",
      replyToId: replyToId || null,
      reactions: [],
      createdAt: new Date(),
    };

    const result = await db.collection("group_messages").insertOne(message);

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(groupId) },
      {
        $set: {
          lastMessage: { text: text.trim().slice(0, 100), senderId: userId, senderUsername: sender?.username, createdAt: message.createdAt },
          updatedAt: new Date(),
        },
      }
    );

    // Уведомляем участников через SSE
    for (const member of group.members) {
      if (member.userId === userId) continue;
      pushNotification(member.userId, {
        type: "group_message",
        groupId,
        groupName: group.name,
        username: sender?.username || "Кто-то",
        text: text.trim().slice(0, 100),
      });
    }

    // Обработка @mentions — отправляем персональные уведомления
    const mentions = text.match(/@(\w+)/g);
    if (mentions && mentions.length > 0) {
      const mentionedUsernames = mentions.map((m) => m.slice(1).toLowerCase());
      const mentionedUsers = await db.collection("users")
        .find({ username: { $in: mentionedUsernames.map((u) => new RegExp(`^${u}$`, "i")) } })
        .project({ _id: 1, username: 1 })
        .toArray();

      for (const mu of mentionedUsers) {
        const muId = mu._id.toString();
        if (muId === userId) continue;
        if (!group.members.some((gm) => gm.userId === muId)) continue;
        pushNotification(muId, {
          type: "group_mention",
          groupId,
          groupName: group.name,
          username: sender?.username || "Кто-то",
          text: text.trim().slice(0, 100),
        });
      }
    }

    // Подгружаем replyTo если есть
    let replyTo = null;
    if (replyToId) {
      try {
        const orig = await db.collection("group_messages").findOne({ _id: new ObjectId(replyToId) });
        if (orig) {
          const replySender = await db.collection("users").findOne(
            { _id: new ObjectId(orig.senderId) },
            { projection: { username: 1 } }
          );
          replyTo = {
            senderId: orig.senderId,
            senderName: replySender?.username || "Удалённый",
            text: orig.text?.slice(0, 100) || "",
          };
        }
      } catch { /* ignore invalid id */ }
    }

    return NextResponse.json({
      id: result.insertedId.toString(),
      senderId: userId,
      senderUsername: sender?.username || "Вы",
      senderAvatarUrl: sender?.avatarUrl || null,
      senderEquippedItems: sender?.equippedItems || {},
      text: text.trim(),
      type: "text",
      imageUrl: null,
      audioUrl: null,
      audioDuration: 0,
      replyToId: message.replyToId,
      replyTo,
      createdAt: message.createdAt,
      reactions: [],
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
