import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const ALLOWED_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// PATCH /api/groups/[groupId]/messages/[messageId]/react — toggle реакции
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

  const { emoji } = await request.json();
  if (!ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: "Недопустимый emoji" }, { status: 400 });
  }

  let oid;
  try {
    oid = new ObjectId(messageId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  // Атомарный toggle: сначала пробуем убрать существующую реакцию
  const pullResult = await db.collection("group_messages").findOneAndUpdate(
    { _id: oid, groupId, "reactions.userId": userId, "reactions.emoji": emoji },
    { $pull: { reactions: { userId, emoji } } },
    { returnDocument: "after" }
  );

  if (pullResult) {
    return NextResponse.json({ reactions: pullResult.reactions || [] });
  }

  // Реакции не было — добавляем (заменяя предыдущую реакцию юзера)
  const updated = await db.collection("group_messages").findOneAndUpdate(
    { _id: oid, groupId },
    [
      { $set: {
        reactions: {
          $concatArrays: [
            { $filter: { input: { $ifNull: ["$reactions", []] }, as: "r", cond: { $ne: ["$$r.userId", userId] } } },
            [{ userId, emoji }]
          ]
        }
      }}
    ],
    { returnDocument: "after" }
  );

  if (!updated) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }

  return NextResponse.json({ reactions: updated.reactions || [] });
}
