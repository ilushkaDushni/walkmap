import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// PATCH /api/messages/[conversationKey]/read — пометить сообщения как прочитанные
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const db = await getDb();

  // Помечаем все непрочитанные от собеседника как прочитанные
  const result = await db.collection("messages").updateMany(
    { conversationKey, senderId: { $ne: userId }, readAt: null },
    { $set: { readAt: new Date() } }
  );

  // Обновляем lastActivityAt (тротлинг 30с)
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId), $or: [
      { lastActivityAt: { $exists: false } },
      { lastActivityAt: { $lt: new Date(Date.now() - 30000) } }
    ]},
    { $set: { lastActivityAt: new Date() } }
  );

  return NextResponse.json({ updated: result.modifiedCount });
}
