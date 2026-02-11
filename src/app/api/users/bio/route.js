import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { bio } = await request.json();

  if (typeof bio !== "string") {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const trimmed = bio.trim().slice(0, 200);

  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(auth.user._id) },
    { $set: { bio: trimmed } },
  );

  return NextResponse.json({ bio: trimmed });
}
