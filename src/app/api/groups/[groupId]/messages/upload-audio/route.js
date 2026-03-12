import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { uploadFile } from "@/lib/storage";
import { pushNotification } from "@/lib/sse";

const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

// POST /api/groups/[groupId]/messages/upload-audio — отправка голосового сообщения в групповой чат
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();

    // Проверяем что пользователь — участник группы
    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group || !group.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

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
    const key = `groups/${groupId}/voice_${userId}_${Date.now()}.${ext}`;
    const audioUrl = await uploadFile(key, Buffer.from(arrayBuffer), file.type);

    const message = {
      groupId,
      senderId: userId,
      text: null,
      type: "voice",
      audioUrl,
      audioDuration: duration || 0,
      replyToId: null,
      reactions: [],
      createdAt: new Date(),
    };

    const result = await db.collection("group_messages").insertOne(message);

    // Обновляем lastMessage в группе
    const sender = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { username: 1, avatarUrl: 1, equippedItems: 1 } }
    );

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(groupId) },
      {
        $set: {
          lastMessage: { text: "Голосовое сообщение", senderId: userId, senderUsername: sender?.username, createdAt: message.createdAt },
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
        text: "Голосовое сообщение",
      });
    }

    return NextResponse.json({
      id: result.insertedId.toString(),
      senderId: userId,
      senderUsername: sender?.username || "Вы",
      senderAvatarUrl: sender?.avatarUrl || null,
      senderEquippedItems: sender?.equippedItems || {},
      text: null,
      type: "voice",
      audioUrl,
      audioDuration: message.audioDuration,
      imageUrl: null,
      createdAt: message.createdAt,
      reactions: [],
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
