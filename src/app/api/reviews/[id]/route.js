import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions } from "@/lib/permissions";

// PATCH /api/reviews/[id] — toggle featured (reviews.manage only)
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const perms = await resolveUserPermissions(auth.user);
  if (!perms.includes("reviews.manage")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { featured } = await request.json();

  const db = await getDb();
  const review = await db.collection("reviews").findOne({ _id: new ObjectId(id) });

  if (!review) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  const newFeatured = typeof featured === "boolean" ? featured : !review.featured;

  await db.collection("reviews").updateOne(
    { _id: new ObjectId(id) },
    { $set: { featured: newFeatured } }
  );

  return NextResponse.json({ ok: true, featured: newFeatured });
}

// DELETE /api/reviews/[id]
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const review = await db.collection("reviews").findOne({ _id: new ObjectId(id) });

  if (!review) {
    return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
  }

  const isOwner = review.userId === auth.user._id.toString();

  if (!isOwner) {
    const perms = await resolveUserPermissions(auth.user);
    if (!perms.includes("reviews.manage")) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }
  }

  await db.collection("reviews").deleteOne({ _id: new ObjectId(id) });

  return NextResponse.json({ ok: true });
}
