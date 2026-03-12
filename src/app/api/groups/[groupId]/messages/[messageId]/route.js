import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// DELETE /api/groups/[groupId]/messages/[messageId] — удалить сообщение в группе
export async function DELETE(request, { params }) {
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

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode"); // "all" или "self"

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

  if (mode === "all") {
    // Удалить для всех — автор, admin или owner
    const callerMember = group.members.find((m) => m.userId === userId);
    const isAdminOrOwner = callerMember && (callerMember.role === "owner" || callerMember.role === "admin");
    if (message.senderId !== userId && !isAdminOrOwner) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    await db.collection("group_messages").deleteOne({ _id: oid });
    return NextResponse.json({ deleted: true, mode: "all" });
  }

  // Удалить для себя
  await db.collection("group_messages").updateOne(
    { _id: oid },
    { $addToSet: { deletedFor: userId } }
  );
  return NextResponse.json({ deleted: true, mode: "self" });
}
