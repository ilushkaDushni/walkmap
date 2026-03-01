import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { checkProfanity, checkFlood } from "@/lib/profanity";

// GET /api/reviews — public, paginated
// ?featured=true — только отмеченные для главной
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const featuredOnly = searchParams.get("featured") === "true";

  const db = await getDb();
  const filter = featuredOnly ? { featured: true } : {};

  const reviews = await db.collection("reviews").aggregate([
    { $match: filter },
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
        rating: 1,
        featured: 1,
        createdAt: 1,
        userId: 1,
        username: "$user.username",
        avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
      },
    },
  ]).toArray();

  const total = await db.collection("reviews").countDocuments(filter);

  const serialized = reviews.map((r) => ({
    id: r._id.toString(),
    text: r.text,
    rating: r.rating,
    featured: !!r.featured,
    createdAt: r.createdAt,
    userId: r.userId,
    username: r.username,
    avatarUrl: r.avatarUrl,
  }));

  return NextResponse.json({ reviews: serialized, total });
}

// POST /api/reviews — auth required
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { text, rating } = await request.json();

  // Validate rating
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Оценка от 1 до 5" }, { status: 400 });
  }

  // Validate text
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
  }

  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    return NextResponse.json({ error: "Отзыв от 1 до 500 символов" }, { status: 400 });
  }

  // Profanity check
  const profanity = checkProfanity(trimmed);
  if (profanity.hasProfanity) {
    return NextResponse.json(
      { error: "Отзыв содержит недопустимые выражения" },
      { status: 400 }
    );
  }

  // Flood check (separate key from comments)
  const flood = checkFlood(auth.user._id.toString() + "_review", 20_000);
  if (flood.isFlooding) {
    const secs = Math.ceil(flood.retryAfterMs / 1000);
    return NextResponse.json(
      { error: `Подождите ${secs} сек. перед отправкой следующего отзыва` },
      { status: 429 }
    );
  }

  const db = await getDb();

  const review = {
    userId: auth.user._id.toString(),
    rating,
    text: trimmed,
    featured: false,
    createdAt: new Date(),
  };

  const result = await db.collection("reviews").insertOne(review);

  return NextResponse.json({
    id: result.insertedId.toString(),
    text: trimmed,
    rating,
    featured: false,
    createdAt: review.createdAt,
    userId: review.userId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
  }, { status: 201 });
}
