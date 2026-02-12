import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// DELETE /api/admin/comments/[commentId] — удалить комментарий (каскадно)
export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, "comments.manage");
  if (error) return error;

  const { commentId } = await params;

  if (!ObjectId.isValid(commentId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const comment = await db.collection("comments").findOne({ _id: new ObjectId(commentId) });

  if (!comment) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  await db.collection("comments").deleteOne({ _id: new ObjectId(commentId) });

  // Каскадно удаляем ответы (если это top-level коммент)
  if (!comment.parentId) {
    await db.collection("comments").deleteMany({ parentId: commentId });
  }

  return NextResponse.json({ ok: true });
}
