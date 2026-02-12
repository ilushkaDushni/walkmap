import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// PATCH /api/notifications/read — прочитать уведомления
// body: { ids: string[] } — конкретные, или {} — все
export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();
  const userId = auth.user._id.toString();

  let body = {};
  try {
    body = await request.json();
  } catch {
    // пустое тело = прочитать все
  }

  const filter = { userId, read: false };

  if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
    const objectIds = body.ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    filter._id = { $in: objectIds };
  }

  const result = await db.collection("notifications").updateMany(filter, {
    $set: { read: true },
  });

  return NextResponse.json({ updated: result.modifiedCount });
}
