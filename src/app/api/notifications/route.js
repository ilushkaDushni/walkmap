import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/notifications — список уведомлений (пагинация)
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const db = await getDb();
  const userId = auth.user._id.toString();

  const [notifications, total] = await Promise.all([
    db.collection("notifications")
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
    db.collection("notifications").countDocuments({ userId }),
  ]);

  const serialized = notifications.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    data: n.data,
    read: n.read,
    createdAt: n.createdAt,
  }));

  return NextResponse.json({ notifications: serialized, total });
}
