import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const VALID_REASONS = ["spam", "nsfw", "offensive", "other"];

// POST /api/routes/[id]/comments/[commentId]/report — пожаловаться на комментарий
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id, commentId } = await params;

  if (!ObjectId.isValid(commentId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { reason, comment: reportComment } = await request.json();

  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: "Укажите причину жалобы" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();

  const targetComment = await db.collection("comments").findOne({ _id: new ObjectId(commentId), routeId: id });
  if (!targetComment) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  if (targetComment.userId === userId) {
    return NextResponse.json({ error: "Нельзя жаловаться на свой комментарий" }, { status: 400 });
  }

  // Дубликат
  const existing = await db.collection("route_post_reports").findOne({
    postId: commentId, reporterId: userId, targetType: "comment",
  });
  if (existing) {
    return NextResponse.json({ error: "Вы уже отправляли жалобу на этот комментарий" }, { status: 409 });
  }

  await db.collection("route_post_reports").insertOne({
    postId: commentId,
    routeId: id,
    targetType: "comment",
    reporterId: userId,
    postAuthorId: targetComment.userId,
    reason,
    comment: (reportComment || "").trim().slice(0, 300) || null,
    status: "pending",
    resolvedBy: null,
    resolvedAt: null,
    action: null,
    adminComment: null,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
