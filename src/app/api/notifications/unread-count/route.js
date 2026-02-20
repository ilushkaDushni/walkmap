import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
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

  // Heartbeat: обновляем lastActivityAt (тротлинг 60с)
  db.collection("users").updateOne(
    { _id: new ObjectId(auth.user._id), $or: [
      { lastActivityAt: { $exists: false } },
      { lastActivityAt: { $lt: new Date(Date.now() - 60000) } }
    ]},
    { $set: { lastActivityAt: new Date() } }
  );

  return NextResponse.json({ count });
}
