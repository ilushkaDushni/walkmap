import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 минут

// PATCH /api/messages/[conversationKey]/[messageId]/edit — редактирование
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey, messageId } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
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

  if (message.senderId !== userId) {
    return NextResponse.json({ error: "Можно редактировать только свои сообщения" }, { status: 403 });
  }

  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json({ error: "Время редактирования истекло (15 мин)" }, { status: 400 });
  }

  await db.collection("messages").updateOne(
    { _id: oid },
    { $set: { text: trimmed, editedAt: new Date() } }
  );

  return NextResponse.json({ ok: true, text: trimmed, editedAt: new Date() });
}
