import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";
import { resolveUserPermissions } from "@/lib/permissions";

const ALLOWED_EMOJI = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// PATCH /api/messages/[conversationKey]/[messageId]/react — toggle реакции
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey, messageId } = await params;
  const userId = auth.user._id.toString();

  if (isAdminConversationKey(conversationKey)) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    if (userId !== targetUserId) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
    }
  } else {
    const parts = conversationKey.split("_");
    if (!parts.includes(userId)) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
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

  // Атомарный toggle: проверяем наличие реакции и переключаем за одну операцию
  // Сначала пробуем убрать существующую реакцию этого юзера с этим emoji
  const pullResult = await db.collection("messages").findOneAndUpdate(
    { _id: oid, conversationKey, "reactions.userId": userId, "reactions.emoji": emoji },
    { $pull: { reactions: { userId, emoji } } },
    { returnDocument: "after" }
  );

  if (pullResult) {
    return NextResponse.json({ reactions: pullResult.reactions || [] });
  }

  // Реакции не было — добавляем (заменяя предыдущую реакцию юзера, если была)
  const updated = await db.collection("messages").findOneAndUpdate(
    { _id: oid, conversationKey },
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
