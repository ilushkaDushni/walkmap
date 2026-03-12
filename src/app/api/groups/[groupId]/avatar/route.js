import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { uploadFile, deleteFile } from "@/lib/storage";
import sharp from "sharp";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// POST /api/groups/[groupId]/avatar — загрузить/обновить аватарку группы
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { groupId } = await params;
  const userId = auth.user._id.toString();
  const db = await getDb();

  const group = await db.collection("group_chats").findOne({
    _id: new ObjectId(groupId),
    "members.userId": userId,
  });
  if (!group) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const member = group.members.find((m) => m.userId === userId);
  if (!member || member.role !== "owner") {
    return NextResponse.json({ error: "Только создатель может менять аватарку" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Файл обязателен" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Только JPEG, PNG, WebP" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимум 5 МБ" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = await sharp(Buffer.from(arrayBuffer))
    .resize(256, 256, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();

  const key = `groups/${groupId}/avatar_${Date.now()}.webp`;
  const avatarUrl = await uploadFile(key, buffer, "image/webp");

  // Удаляем старую аватарку
  if (group.avatarUrl) {
    deleteFile(group.avatarUrl).catch(() => {});
  }

  await db.collection("group_chats").updateOne(
    { _id: new ObjectId(groupId) },
    { $set: { avatarUrl, updatedAt: new Date() } }
  );

  return NextResponse.json({ avatarUrl });
}

// DELETE /api/groups/[groupId]/avatar — удалить аватарку
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { groupId } = await params;
  const userId = auth.user._id.toString();
  const db = await getDb();

  const group = await db.collection("group_chats").findOne({
    _id: new ObjectId(groupId),
    "members.userId": userId,
  });
  if (!group) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const member = group.members.find((m) => m.userId === userId);
  if (!member || member.role !== "owner") {
    return NextResponse.json({ error: "Только создатель" }, { status: 403 });
  }

  if (group.avatarUrl) {
    deleteFile(group.avatarUrl).catch(() => {});
  }

  await db.collection("group_chats").updateOne(
    { _id: new ObjectId(groupId) },
    { $set: { avatarUrl: null, updatedAt: new Date() } }
  );

  return NextResponse.json({ success: true });
}
