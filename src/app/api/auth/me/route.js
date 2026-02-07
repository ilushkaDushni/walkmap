import { getDb } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/tokens";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Токен истёк или невалиден" }, { status: 401 });
  }

  let objectId;
  try {
    objectId = new ObjectId(payload.userId);
  } catch {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: objectId });

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}
