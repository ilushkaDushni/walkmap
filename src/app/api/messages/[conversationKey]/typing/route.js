import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";
import { resolveUserPermissions } from "@/lib/permissions";
import { pushNotification } from "@/lib/sse";

// POST /api/messages/[conversationKey]/typing — upsert typing indicator
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
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

  const db = await getDb();
  await db.collection("typing_indicators").updateOne(
    { conversationKey, userId },
    { $set: { conversationKey, userId, updatedAt: new Date() } },
    { upsert: true }
  );

  // SSE typing push to recipient
  if (isAdminConversationKey(conversationKey)) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    const recipientId = userId === targetUserId ? null : targetUserId;
    if (recipientId) {
      pushNotification(recipientId, { type: "typing", conversationKey, userId });
    }
  } else {
    const parts = conversationKey.split("_");
    const recipientId = parts.find((p) => p !== userId);
    if (recipientId) {
      pushNotification(recipientId, { type: "typing", conversationKey, userId });
    }
  }

  return NextResponse.json({ ok: true });
}
