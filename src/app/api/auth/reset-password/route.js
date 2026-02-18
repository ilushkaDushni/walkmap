import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request) {
  const { email, code, newPassword } = await request.json();

  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
  }

  const db = await getDb();
  const reset = await db.collection("password_resets").findOne({ email, code });

  if (!reset) {
    return NextResponse.json({ error: "Неверный код" }, { status: 400 });
  }

  if (new Date() > reset.expiresAt) {
    await db.collection("password_resets").deleteMany({ email });
    return NextResponse.json({ error: "Код истёк, запросите новый" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await db.collection("users").updateOne(
    { _id: new ObjectId(reset.userId) },
    { $set: { passwordHash: newHash } }
  );

  // Удаляем все refresh-токены (разлогин со всех устройств)
  await db.collection("refresh_tokens").deleteMany({ userId: reset.userId });

  // Очищаем код
  await db.collection("password_resets").deleteMany({ email });

  return NextResponse.json({ ok: true });
}
