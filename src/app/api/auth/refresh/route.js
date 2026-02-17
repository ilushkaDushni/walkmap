import { getDb } from "@/lib/mongodb";
import { signAccessToken, generateRefreshToken } from "@/lib/tokens";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { buildUserResponse, isSuperadmin } from "@/lib/permissions";

export async function POST(request) {
  const cookieHeader = request.cookies.get("refreshToken");
  const token = cookieHeader?.value;

  if (!token) {
    return NextResponse.json({ error: "Нет refresh токена" }, { status: 401 });
  }

  const db = await getDb();
  const stored = await db.collection("refresh_tokens").findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!stored) {
    const res = NextResponse.json({ error: "Невалидный refresh токен" }, { status: 401 });
    res.cookies.set("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  const user = await db.collection("users").findOne({ _id: new ObjectId(stored.userId) });

  if (!user) {
    await db.collection("refresh_tokens").deleteOne({ _id: stored._id });
    const res = NextResponse.json({ error: "Пользователь не найден" }, { status: 401 });
    res.cookies.set("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  // Проверка бана (суперадмин не может быть забанен)
  if (user.banned && !isSuperadmin(user)) {
    await db.collection("refresh_tokens").deleteMany({ userId: stored.userId });
    const res = NextResponse.json({ error: "Аккаунт заблокирован", banned: true, username: user.username }, { status: 403 });
    res.cookies.set("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  }

  // Rotate: delete old refresh token, create new one
  const newRefreshToken = generateRefreshToken();
  await db.collection("refresh_tokens").deleteOne({ _id: stored._id });
  await db.collection("refresh_tokens").insertOne({
    token: newRefreshToken,
    userId: stored.userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Обновляем lastActivityAt
  await db.collection("users").updateOne(
    { _id: new ObjectId(stored.userId) },
    { $set: { lastActivityAt: new Date() } }
  );

  const accessToken = await signAccessToken({ userId: stored.userId });

  const res = NextResponse.json({
    user: await buildUserResponse(user),
    accessToken,
  });

  res.cookies.set("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return res;
}
