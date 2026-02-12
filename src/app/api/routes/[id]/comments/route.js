import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";
import { checkAndGrantAchievements } from "@/lib/achievementEngine";

// GET /api/routes/[id]/comments — public, paginated (только top-level с вложенными replies)
export async function GET(request, { params }) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const db = await getDb();

  // Получаем top-level комменты (parentId: null)
  const comments = await db.collection("comments").aggregate([
    { $match: { routeId: id, parentId: null } },
    { $sort: { createdAt: -1 } },
    { $skip: offset },
    { $limit: limit },
    { $addFields: { userObjId: { $toObjectId: "$userId" } } },
    { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    // Подсчёт ответов
    {
      $lookup: {
        from: "comments",
        let: { parentId: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$parentId", "$$parentId"] } } },
          { $count: "count" },
        ],
        as: "replyCountArr",
      },
    },
    // Первые 3 ответа
    {
      $lookup: {
        from: "comments",
        let: { parentId: { $toString: "$_id" } },
        pipeline: [
          { $match: { $expr: { $eq: ["$parentId", "$$parentId"] } } },
          { $sort: { createdAt: 1 } },
          { $limit: 3 },
          { $addFields: { userObjId: { $toObjectId: "$userId" } } },
          { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
          { $unwind: "$user" },
          {
            $project: {
              _id: 1, text: 1, createdAt: 1, userId: 1, parentId: 1,
              username: "$user.username",
              avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
            },
          },
        ],
        as: "replies",
      },
    },
    {
      $project: {
        _id: 1, text: 1, createdAt: 1, userId: 1, parentId: 1,
        username: "$user.username",
        avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
        replyCount: { $ifNull: [{ $arrayElemAt: ["$replyCountArr.count", 0] }, 0] },
        replies: 1,
      },
    },
  ]).toArray();

  const total = await db.collection("comments").countDocuments({ routeId: id, parentId: null });

  const serialized = comments.map((c) => ({
    id: c._id.toString(),
    text: c.text,
    createdAt: c.createdAt,
    userId: c.userId,
    parentId: null,
    username: c.username,
    avatarUrl: c.avatarUrl,
    replyCount: c.replyCount,
    replies: (c.replies || []).map((r) => ({
      id: r._id.toString(),
      text: r.text,
      createdAt: r.createdAt,
      userId: r.userId,
      parentId: r.parentId,
      username: r.username,
      avatarUrl: r.avatarUrl,
    })),
  }));

  return NextResponse.json({ comments: serialized, total });
}

// POST /api/routes/[id]/comments — auth required (top-level или reply)
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { text, parentId } = await request.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    return NextResponse.json({ error: "Комментарий от 1 до 500 символов" }, { status: 400 });
  }

  const db = await getDb();

  // Check route exists
  const route = await db.collection("routes").findOne({ _id: new ObjectId(id) });
  if (!route) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  // Если это ответ — проверяем что родительский коммент существует и он top-level
  let resolvedParentId = null;
  if (parentId) {
    if (!ObjectId.isValid(parentId)) {
      return NextResponse.json({ error: "Некорректный parentId" }, { status: 400 });
    }
    const parentComment = await db.collection("comments").findOne({ _id: new ObjectId(parentId) });
    if (!parentComment) {
      return NextResponse.json({ error: "Родительский комментарий не найден" }, { status: 404 });
    }
    // Только 1 уровень вложенности — если parentComment сам reply, отвечаем на его parent
    resolvedParentId = parentComment.parentId || parentComment._id.toString();
  }

  const comment = {
    userId: auth.user._id.toString(),
    routeId: id,
    text: trimmed,
    parentId: resolvedParentId,
    createdAt: new Date(),
  };

  const result = await db.collection("comments").insertOne(comment);

  // Уведомление автору родительского комментария (если это ответ и автор другой)
  if (resolvedParentId) {
    const parentComment = await db.collection("comments").findOne({ _id: new ObjectId(resolvedParentId) });
    if (parentComment && parentComment.userId !== auth.user._id.toString()) {
      await createNotification(parentComment.userId, "comment_reply", {
        commentId: result.insertedId.toString(),
        parentCommentId: resolvedParentId,
        routeId: id,
        routeTitle: route.title || "",
        username: auth.user.username,
        text: trimmed.slice(0, 100),
      });
    }
  }

  // Проверяем достижения за комментарии
  const { newAchievements, rewardCoins } = await checkAndGrantAchievements(auth.user._id);

  return NextResponse.json({
    id: result.insertedId.toString(),
    text: trimmed,
    createdAt: comment.createdAt,
    userId: comment.userId,
    parentId: resolvedParentId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
    newAchievements,
    achievementRewardCoins: rewardCoins,
  }, { status: 201 });
}
