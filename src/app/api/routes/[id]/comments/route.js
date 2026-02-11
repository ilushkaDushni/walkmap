import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/routes/[id]/comments — public, paginated
export async function GET(request, { params }) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const db = await getDb();

  const comments = await db.collection("comments").aggregate([
    { $match: { routeId: id } },
    { $sort: { createdAt: -1 } },
    { $skip: offset },
    { $limit: limit },
    { $addFields: { userObjId: { $toObjectId: "$userId" } } },
    { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    {
      $project: {
        _id: 1,
        text: 1,
        createdAt: 1,
        userId: 1,
        username: "$user.username",
        avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
      },
    },
  ]).toArray();

  const total = await db.collection("comments").countDocuments({ routeId: id });

  const serialized = comments.map((c) => ({
    id: c._id.toString(),
    text: c.text,
    createdAt: c.createdAt,
    userId: c.userId,
    username: c.username,
    avatarUrl: c.avatarUrl,
  }));

  return NextResponse.json({ comments: serialized, total });
}

// POST /api/routes/[id]/comments — auth required
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { text } = await request.json();

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

  const comment = {
    userId: auth.user._id.toString(),
    routeId: id,
    text: trimmed,
    createdAt: new Date(),
  };

  const result = await db.collection("comments").insertOne(comment);

  return NextResponse.json({
    id: result.insertedId.toString(),
    text: trimmed,
    createdAt: comment.createdAt,
    userId: comment.userId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
  }, { status: 201 });
}
