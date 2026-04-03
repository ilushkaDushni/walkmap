import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions } from "@/lib/permissions";
import { isAdminConversationKey, getTargetUserIdFromAdminKey } from "@/lib/conversationAccess";

// GET /api/messages/[conversationKey]/media — все медиа из переписки
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();
  const isAdminConv = isAdminConversationKey(conversationKey);

  // Проверка доступа
  if (isAdminConv) {
    const targetUserId = getTargetUserIdFromAdminKey(conversationKey);
    if (userId !== targetUserId) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
    }
  } else {
    const parts = conversationKey.split("_");
    if (parts.length !== 2 || !parts.includes(userId)) {
      const perms = await resolveUserPermissions(auth.user);
      if (!perms.includes("users.view")) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
    }
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all"; // "image", "voice", "all"
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const before = searchParams.get("before");

  const db = await getDb();

  const filter = {
    conversationKey,
    deletedFor: { $ne: userId },
  };

  // Фильтр по типу медиа
  if (type === "image") {
    filter.type = "image";
  } else if (type === "voice") {
    filter.type = "voice";
  } else {
    filter.type = { $in: ["image", "voice"] };
  }

  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const raw = await db.collection("messages")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = raw.length > limit;
  const items = (hasMore ? raw.slice(0, limit) : raw).map((m) => ({
    id: m._id.toString(),
    type: m.type,
    imageUrl: m.imageUrl || null,
    audioUrl: m.audioUrl || null,
    audioDuration: m.audioDuration || 0,
    senderId: m.senderId,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ items, hasMore });
}
