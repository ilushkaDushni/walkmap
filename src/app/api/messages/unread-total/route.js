import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/messages/unread-total — общее количество непрочитанных сообщений
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const db = await getDb();

  const count = await db.collection("messages").countDocuments({
    conversationKey: { $regex: userId },
    senderId: { $ne: userId },
    readAt: null,
    deletedFor: { $ne: userId },
  });

  return NextResponse.json({ count });
}
