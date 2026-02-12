import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/notifications/unread-count
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();
  const count = await db.collection("notifications").countDocuments({
    userId: auth.user._id.toString(),
    read: false,
  });

  return NextResponse.json({ count });
}
