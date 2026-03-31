import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { deleteFile } from "@/lib/storage";
import { resolveUserPermissions } from "@/lib/permissions";

// DELETE /api/routes/[id]/feed/[postId] — удалить пост (автор или модератор)
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id, postId } = await params;

  if (!ObjectId.isValid(postId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const post = await db.collection("route_posts").findOne({ _id: new ObjectId(postId), routeId: id });
  if (!post) {
    return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  }

  const userId = auth.user._id.toString();
  const isOwner = post.userId === userId;

  if (!isOwner) {
    const perms = await resolveUserPermissions(auth.user);
    if (!perms.includes("route_posts.moderate")) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }
  }

  // Удаляем фото из S3
  if (post.imageUrl) {
    try { await deleteFile(post.imageUrl); } catch {}
  }

  await db.collection("route_posts").deleteOne({ _id: new ObjectId(postId) });

  return NextResponse.json({ ok: true });
}
