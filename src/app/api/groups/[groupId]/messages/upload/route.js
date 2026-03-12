import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { uploadFile } from "@/lib/storage";
import { pushNotification } from "@/lib/sse";
import sharp from "sharp";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// POST /api/groups/[groupId]/messages/upload — отправка картинки в групповой чат
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

    const key = `groups/${groupId}/${userId}_${Date.now()}.webp`;
    const imageUrl = await uploadFile(key, buffer, "image/webp");

    const message = {
      groupId,
      senderId: userId,
      text: null,
      type: "image",
      imageUrl,
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
          lastMessage: { text: "Фото", senderId: userId, senderUsername: sender?.username, createdAt: message.createdAt },
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
        text: "Отправил фото",
      });
    }

    return NextResponse.json({
      id: result.insertedId.toString(),
      senderId: userId,
      senderUsername: sender?.username || "Вы",
      senderAvatarUrl: sender?.avatarUrl || null,
      senderEquippedItems: sender?.equippedItems || {},
      text: null,
      type: "image",
      imageUrl,
      audioUrl: null,
      audioDuration: 0,
      createdAt: message.createdAt,
      reactions: [],
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
