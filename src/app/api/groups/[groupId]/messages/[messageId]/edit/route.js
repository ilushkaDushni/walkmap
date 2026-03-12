import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 минут

// PATCH /api/groups/[groupId]/messages/[messageId]/edit — редактирование сообщения в группе
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

  const { text } = await request.json();
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
  }
  const trimmed = text.trim();
  if (trimmed.length > 1000) {
    return NextResponse.json({ error: "Максимум 1000 символов" }, { status: 400 });
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

  // Только автор может редактировать
  if (message.senderId !== userId) {
    return NextResponse.json({ error: "Можно редактировать только свои сообщения" }, { status: 403 });
  }

  // Проверяем окно редактирования
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Время редактирования истекло (15 мин)" }, { status: 400 });
  }

  await db.collection("group_messages").updateOne(
    { _id: oid },
    { $set: { text: trimmed, editedAt: new Date() } }
  );

  return NextResponse.json({ ok: true, text: trimmed, editedAt: new Date() });
}
