import { getDb } from "@/lib/mongodb";
import { signAccessToken, generateRefreshToken } from "@/lib/tokens";
import { NextResponse } from "next/server";

export async function POST(request) {
  const { email, code } = await request.json();

  if (!email || !code) {
    return NextResponse.json({ error: "Введите код" }, { status: 400 });
  }

  const db = await getDb();
  const pending = await db.collection("pending_verifications").findOne({
    email,
    code,
    expiresAt: { $gt: new Date() },
  });

  if (!pending) {
    return NextResponse.json({ error: "Неверный или просроченный код" }, { status: 400 });
  }

  // Создаём пользователя
  const result = await db.collection("users").insertOne({
    username: pending.username,
    email: pending.email,
    passwordHash: pending.passwordHash,
    role: "user",
    coins: 0,
    banned: false,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  });

  // Удаляем pending
  await db.collection("pending_verifications").deleteMany({ email });

  const userId = result.insertedId.toString();

  const accessToken = await signAccessToken({ userId, role: "user" });
  const refreshToken = generateRefreshToken();

  await db.collection("refresh_tokens").insertOne({
    token: refreshToken,
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const res = NextResponse.json({
    user: {
      id: userId,
      username: pending.username,
      email: pending.email,
      role: "user",
    },
    accessToken,
  });

  res.cookies.set("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return res;
}
