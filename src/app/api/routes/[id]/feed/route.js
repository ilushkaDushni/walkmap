import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { uploadFile } from "@/lib/storage";
import { checkProfanity, checkFlood } from "@/lib/profanity";
import sharp from "sharp";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTOS_PER_WALK = 10;

// GET /api/routes/[id]/feed — лента маршрута (фото + комменты)
export async function GET(request, { params }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const type = searchParams.get("type"); // "photo" | "comment" | null (all)
  const checkpoint = searchParams.get("checkpoint"); // number or null
  const sort = searchParams.get("sort") || "newest"; // "newest" | "popular"
  const friendsOnly = searchParams.get("friendsOnly") === "true";
  const currentUserId = searchParams.get("userId"); // для фильтра друзей

  const db = await getDb();

  const match = { routeId: id, status: "visible" };
  if (type === "photo") match.type = "photo";
  if (type === "comment") match.type = "comment";
  if (checkpoint !== null && checkpoint !== undefined && checkpoint !== "") {
    match.checkpointIndex = parseInt(checkpoint, 10);
  }

  // Фильтр "только друзья"
  let friendIds = null;
  if (friendsOnly && currentUserId) {
    const friendships = await db.collection("friendships").find({
      users: currentUserId,
      status: "accepted",
    }).toArray();
    friendIds = friendships.flatMap((f) => f.users.filter((u) => u !== currentUserId));
    match.userId = { $in: [...friendIds, currentUserId] };
  }

  const sortStage = sort === "popular"
    ? { likes: -1, createdAt: -1 }
    : { createdAt: -1 };

  const posts = await db.collection("route_posts").aggregate([
    { $match: match },
    { $sort: sortStage },
    { $skip: offset },
    { $limit: limit },
    { $addFields: { userObjId: { $toObjectId: "$userId" } } },
    { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    {
      $project: {
        _id: 1, type: 1, text: 1, imageUrl: 1, checkpointIndex: 1,
        coordinates: 1, status: 1, createdAt: 1, likes: 1, likedBy: 1,
        userId: 1,
        username: "$user.username",
        avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
        equippedItems: { $ifNull: ["$user.equippedItems", null] },
      },
    },
  ]).toArray();

  const total = await db.collection("route_posts").countDocuments(match);

  const serialized = posts.map((p) => ({
    id: p._id.toString(),
    type: p.type,
    text: p.text,
    imageUrl: p.imageUrl,
    checkpointIndex: p.checkpointIndex,
    coordinates: p.coordinates,
    createdAt: p.createdAt,
    likes: p.likes || 0,
    liked: currentUserId ? (p.likedBy || []).includes(currentUserId) : false,
    userId: p.userId,
    username: p.username,
    avatarUrl: p.avatarUrl,
    equippedItems: p.equippedItems,
  }));

  return NextResponse.json({ posts: serialized, total });
}

// POST /api/routes/[id]/feed — создать пост (фото или комментарий)
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const route = await db.collection("routes").findOne({ _id: new ObjectId(id) });
  if (!route) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  const userId = auth.user._id.toString();
  const formData = await request.formData();
  const file = formData.get("file");
  const text = (formData.get("text") || "").trim();
  const checkpointIndex = parseInt(formData.get("checkpointIndex") || "-1", 10);
  const lat = parseFloat(formData.get("lat") || "0");
  const lng = parseFloat(formData.get("lng") || "0");

  const hasFile = file && file.size > 0;
  const hasText = text.length > 0;

  if (!hasFile && !hasText) {
    return NextResponse.json({ error: "Нужен текст или фото" }, { status: 400 });
  }

  // Profanity check
  if (hasText) {
    if (text.length > 500) {
      return NextResponse.json({ error: "Максимум 500 символов" }, { status: 400 });
    }
    const profanity = checkProfanity(text);
    if (profanity.hasProfanity) {
      return NextResponse.json({ error: "Текст содержит недопустимые выражения" }, { status: 400 });
    }
  }

  // Flood check
  const flood = checkFlood(userId);
  if (flood.isFlooding) {
    const secs = Math.ceil(flood.retryAfterMs / 1000);
    return NextResponse.json({ error: `Подождите ${secs} сек.` }, { status: 429 });
  }

  let imageUrl = null;
  let postType = "comment";

  if (hasFile) {
    // Rate limit: max photos per route per user
    const photoCount = await db.collection("route_posts").countDocuments({
      routeId: id, userId, type: "photo",
    });
    if (photoCount >= MAX_PHOTOS_PER_WALK) {
      return NextResponse.json({ error: `Максимум ${MAX_PHOTOS_PER_WALK} фото на маршрут` }, { status: 429 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Допустимы только JPEG, PNG, WebP" }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: "Максимум 10 МБ" }, { status: 400 });
    }

    const buffer = await sharp(Buffer.from(arrayBuffer))
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const key = `route-feed/${id}/${userId}_${Date.now()}.webp`;
    imageUrl = await uploadFile(key, buffer, "image/webp");
    postType = "photo";
  }

  const post = {
    routeId: id,
    userId,
    type: postType,
    text: hasText ? text : null,
    imageUrl,
    checkpointIndex,
    coordinates: lat && lng ? { lat, lng } : null,
    status: "visible",
    likes: 0,
    likedBy: [],
    createdAt: new Date(),
  };

  const result = await db.collection("route_posts").insertOne(post);

  return NextResponse.json({
    id: result.insertedId.toString(),
    type: post.type,
    text: post.text,
    imageUrl: post.imageUrl,
    checkpointIndex: post.checkpointIndex,
    coordinates: post.coordinates,
    createdAt: post.createdAt,
    likes: 0,
    liked: false,
    userId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
    equippedItems: auth.user.equippedItems || null,
  }, { status: 201 });
}
