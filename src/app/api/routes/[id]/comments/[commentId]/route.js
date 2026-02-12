import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions } from "@/lib/permissions";

// DELETE /api/routes/[id]/comments/[commentId] — каскадное удаление с ответами
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { commentId } = await params;

  if (!ObjectId.isValid(commentId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const comment = await db.collection("comments").findOne({ _id: new ObjectId(commentId) });

  if (!comment) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  const isOwner = comment.userId === auth.user._id.toString();

  if (!isOwner) {
    const perms = await resolveUserPermissions(auth.user);
    if (!perms.includes("comments.manage")) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
  }

  // Удаляем сам коммент
  await db.collection("comments").deleteOne({ _id: new ObjectId(commentId) });

  // Каскадно удаляем ответы (если это top-level коммент)
  if (!comment.parentId) {
    await db.collection("comments").deleteMany({ parentId: commentId });
  }

  return NextResponse.json({ ok: true });
}
