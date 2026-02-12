import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const ALLOWED_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// PATCH /api/messages/[conversationKey]/[messageId]/react — toggle реакции
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey, messageId } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { emoji } = await request.json();
  if (!ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: "Недопустимый emoji" }, { status: 400 });
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

  const reactions = message.reactions || [];
  const existing = reactions.find((r) => r.userId === userId && r.emoji === emoji);

  if (existing) {
    // Убираем реакцию
    await db.collection("messages").updateOne(
      { _id: oid },
      { $pull: { reactions: { userId, emoji } } }
    );
  } else {
    // Добавляем реакцию (убираем предыдущую от этого юзера, если есть)
    await db.collection("messages").updateOne(
      { _id: oid },
      { $pull: { reactions: { userId } } }
    );
    await db.collection("messages").updateOne(
      { _id: oid },
      { $push: { reactions: { userId, emoji } } }
    );
  }

  const updated = await db.collection("messages").findOne({ _id: oid });
  return NextResponse.json({ reactions: updated.reactions || [] });
}
