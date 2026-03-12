import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { pushNotification } from "@/lib/sse";

// POST /api/groups/[groupId]/typing — typing indicator for group chat
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { groupId } = await params;
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

  // Upsert typing indicator
  await db.collection("typing_indicators").updateOne(
    { groupId, userId },
    { $set: { groupId, userId, updatedAt: new Date() } },
    { upsert: true }
  );

  // Push SSE to all other members
  const username = auth.user.username || "Кто-то";
  for (const member of group.members) {
    if (member.userId === userId) continue;
    pushNotification(member.userId, {
      type: "group_typing",
      groupId,
      userId,
      username,
    });
  }

  return NextResponse.json({ ok: true });
}
