import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/routes/[id]/feed/[postId]/like — toggle лайк
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { postId } = await params;

  if (!ObjectId.isValid(postId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();

  const post = await db.collection("route_posts").findOne({ _id: new ObjectId(postId) });
  if (!post) {
    return NextResponse.json({ error: "Пост не найден" }, { status: 404 });
  }

  const alreadyLiked = (post.likedBy || []).includes(userId);

  if (alreadyLiked) {
    await db.collection("route_posts").updateOne(
      { _id: new ObjectId(postId) },
      { $pull: { likedBy: userId }, $inc: { likes: -1 } }
    );
  } else {
    await db.collection("route_posts").updateOne(
      { _id: new ObjectId(postId) },
      { $addToSet: { likedBy: userId }, $inc: { likes: 1 } }
    );
  }

  return NextResponse.json({ liked: !alreadyLiked, likes: (post.likes || 0) + (alreadyLiked ? -1 : 1) });
}
