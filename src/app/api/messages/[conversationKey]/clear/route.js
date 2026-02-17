import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// DELETE /api/messages/[conversationKey]/clear — очистить историю чата (soft delete)
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { conversationKey } = await params;
  const userId = auth.user._id.toString();

  const parts = conversationKey.split("_");
  if (!parts.includes(userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const db = await getDb();

  await db.collection("messages").updateMany(
    { conversationKey },
    { $addToSet: { deletedFor: userId } }
  );

  return NextResponse.json({ ok: true });
}
