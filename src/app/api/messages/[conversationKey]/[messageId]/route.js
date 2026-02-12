import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// DELETE /api/messages/[conversationKey]/[messageId] — удалить сообщение
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey, messageId } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode"); // "all" или "self"

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

  if (mode === "all") {
    // Удалить для всех — любой участник беседы может
    await db.collection("messages").deleteOne({ _id: oid });
    return NextResponse.json({ deleted: true, mode: "all" });
  }

  // Удалить для себя
  await db.collection("messages").updateOne(
    { _id: oid },
    { $addToSet: { deletedFor: userId } }
  );
  return NextResponse.json({ deleted: true, mode: "self" });
}
