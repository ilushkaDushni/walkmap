import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { uploadFile, deleteFile } from "@/lib/storage";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Невалидные данные" }, { status: 400 });
  }

  const file = formData.get("avatar");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Файл не найден" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Допустимы только JPEG, PNG, WebP" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 5 МБ)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const userId = user._id.toString();
  const key = `avatars/${userId}_${Date.now()}.webp`;

  try {
    // Delete old avatar if exists
    if (user.avatarUrl) {
      try {
        await deleteFile(user.avatarUrl);
      } catch {
        // ignore delete errors
      }
    }

    const avatarUrl = await uploadFile(key, buffer, "image/webp");

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { avatarUrl } }
    );

    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  if (!user.avatarUrl) {
    return NextResponse.json({ ok: true });
  }

  try {
    await deleteFile(user.avatarUrl);
  } catch {
    // ignore
  }

  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: user._id },
    { $unset: { avatarUrl: "" } }
  );

  return NextResponse.json({ ok: true });
}
