import { getDb } from "@/lib/mongodb";
import { signAccessToken, generateRefreshToken } from "@/lib/tokens";
import { NextResponse } from "next/server";

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

  // Fetch user to get current role
  const { ObjectId } = await import("mongodb");
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

  // Rotate: delete old refresh token, create new one
  const newRefreshToken = generateRefreshToken();
  await db.collection("refresh_tokens").deleteOne({ _id: stored._id });
  await db.collection("refresh_tokens").insertOne({
    token: newRefreshToken,
    userId: stored.userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  const accessToken = await signAccessToken({
    userId: stored.userId,
    role: user.role,
  });

  const res = NextResponse.json({
    user: {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken,
  });

  res.cookies.set("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });

  return res;
}
