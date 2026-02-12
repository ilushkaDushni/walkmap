import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "avatars");

async function deleteOldAvatar(avatarUrl) {
  if (!avatarUrl) return;
  const prefix = "/api/uploads/";
  if (!avatarUrl.includes(prefix)) return;
  const relativePath = avatarUrl.split(prefix).pop();
  if (!relativePath) return;
  const filePath = path.resolve(process.cwd(), "uploads", relativePath);
  if (!filePath.startsWith(path.resolve(process.cwd(), "uploads"))) return;
  try {
    await unlink(filePath);
  } catch {
    // ignore
  }
}

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

  await deleteOldAvatar(auth.user.avatarUrl);

  const ext = file.name.split(".").pop().toLowerCase();
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);

  const url = `/api/uploads/avatars/${filename}`;

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

  await deleteOldAvatar(auth.user.avatarUrl);

  await db.collection("users").updateOne(
    { _id: new ObjectId(auth.user._id) },
    { $unset: { avatarUrl: "" } },
  );

  return NextResponse.json({ ok: true });
}
