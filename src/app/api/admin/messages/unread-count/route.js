import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/messages/unread-count — непрочитанные от юзеров во всех admin-беседах
export async function GET(request) {
  const { error } = await requirePermission(request, "feedback.manage");
  if (error) return error;

  const db = await getDb();

  const result = await db.collection("messages").aggregate([
    {
      $match: {
        conversationKey: { $regex: /^admin_/ },
        type: { $ne: "admin" },
        readAt: null,
      },
    },
    { $count: "count" },
  ]).toArray();

  return NextResponse.json({ count: result[0]?.count || 0 });
}
