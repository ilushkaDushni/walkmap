import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { put, del } from "@vercel/blob";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Допустимые форматы: JPEG, PNG, WebP" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимальный размер — 5 МБ" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id;

  // Delete old avatar from Blob if exists
  if (auth.user.avatarUrl) {
    try {
      await del(auth.user.avatarUrl);
    } catch {
      // ignore deletion errors
    }
  }

  const ext = file.name.split(".").pop().toLowerCase();
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;

  const { url } = await put(`avatars/${filename}`, file, {
    access: "public",
    contentType: file.type,
  });

  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { avatarUrl: url } },
  );

  return NextResponse.json({ avatarUrl: url });
}

export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();

  // Delete from Blob if exists
  if (auth.user.avatarUrl) {
    try {
      await del(auth.user.avatarUrl);
    } catch {
      // ignore
    }
  }

  await db.collection("users").updateOne(
    { _id: new ObjectId(auth.user._id) },
    { $unset: { avatarUrl: "" } },
  );

  return NextResponse.json({ ok: true });
}
