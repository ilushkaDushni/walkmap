import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const VALID_REASONS = ["spam", "nsfw", "offensive", "other"];

// POST /api/routes/[id]/feed/[postId]/report — пожаловаться на пост
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id, postId } = await params;

  if (!ObjectId.isValid(postId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { reason, comment } = await request.json();

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Укажите причину жалобы" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();

  const post = await db.collection("route_posts").findOne({ _id: new ObjectId(postId), routeId: id });
  if (!post) {
    return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  }

  // Нельзя жаловаться на свой пост
  if (post.userId === userId) {
    return NextResponse.json({ error: "Нельзя жаловаться на свой пост" }, { status: 400 });
  }

  // Проверяем дубликат жалобы
  const existing = await db.collection("route_post_reports").findOne({
    postId: postId, reporterId: userId,
  });
  if (existing) {
    return NextResponse.json({ error: "Вы уже отправляли жалобу на этот пост" }, { status: 409 });
  }

  await db.collection("route_post_reports").insertOne({
    postId,
    routeId: id,
    targetType: "post",
    reporterId: userId,
    postAuthorId: post.userId,
    reason,
    comment: (comment || "").trim().slice(0, 300) || null,
    status: "pending",
    resolvedBy: null,
    resolvedAt: null,
    action: null,
    adminComment: null,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
