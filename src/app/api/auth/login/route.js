import { getDb } from "@/lib/mongodb";
import { signAccessToken, generateRefreshToken } from "@/lib/tokens";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { buildUserResponse, isSuperadmin } from "@/lib/permissions";

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ username });

  if (!user) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  if (user.banned && !isSuperadmin(user)) {
    return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
  }

  const userId = user._id.toString();

  // Обновляем lastLoginAt
  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } }
  );

  const accessToken = await signAccessToken({ userId });
  const refreshToken = generateRefreshToken();

  await db.collection("refresh_tokens").insertOne({
    token: refreshToken,
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const res = NextResponse.json({
    user: await buildUserResponse(user),
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
