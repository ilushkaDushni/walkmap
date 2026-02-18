import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Новый пароль минимум 6 символов" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: auth.user._id });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await db.collection("users").updateOne(
    { _id: auth.user._id },
    { $set: { passwordHash: newHash } }
  );

  // Удаляем все refresh-токены кроме текущего (по cookie)
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/refreshToken=([^;]+)/);
  const currentRefresh = match?.[1];

  if (currentRefresh) {
    await db.collection("refresh_tokens").deleteMany({
      userId: auth.user._id.toString(),
      token: { $ne: currentRefresh },
    });
  }

  return NextResponse.json({ ok: true });
}
