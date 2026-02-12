import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

// GET /api/routes/[id]/comments/[commentId]/replies — пагинированные ответы
export async function GET(request, { params }) {
  const { commentId } = await params;

  if (!ObjectId.isValid(commentId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const db = await getDb();

  const replies = await db.collection("comments").aggregate([
    { $match: { parentId: commentId } },
    { $sort: { createdAt: 1 } },
    { $skip: offset },
    { $limit: limit },
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
  ]).toArray();

  const total = await db.collection("comments").countDocuments({ parentId: commentId });

  const serialized = replies.map((r) => ({
    id: r._id.toString(),
    text: r.text,
    createdAt: r.createdAt,
    userId: r.userId,
    parentId: r.parentId,
    username: r.username,
    avatarUrl: r.avatarUrl,
  }));

  return NextResponse.json({ replies: serialized, total });
}
