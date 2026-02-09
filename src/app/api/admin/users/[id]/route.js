import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminAuth";

// PUT /api/admin/users/[id] — обновить пользователя
export async function PUT(request, { params }) {
  const { payload, error } = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const body = await request.json();
  const db = await getDb();
  const update = {};

  // Роль
  if (body.role !== undefined) {
    if (!["user", "moderator", "admin"].includes(body.role)) {
      return NextResponse.json({ error: "Невалидная роль" }, { status: 400 });
    }
    // Нельзя снять админа с себя
    // Нельзя понизить себя
    if (id === payload.userId) {
      return NextResponse.json({ error: "Нельзя изменить свою роль" }, { status: 400 });
    }
    update.role = body.role;
  }

  // Бан
  if (body.banned !== undefined) {
    if (id === payload.userId) {
      return NextResponse.json({ error: "Нельзя забанить себя" }, { status: 400 });
    }
    update.banned = !!body.banned;
    // При бане удаляем refresh токены
    if (update.banned) {
      await db.collection("refresh_tokens").deleteMany({ userId: id });
    }
  }

  // Монеты (добавить/снять)
  if (body.addCoins !== undefined) {
    const delta = Number(body.addCoins);
    if (isNaN(delta)) {
      return NextResponse.json({ error: "Невалидное число монет" }, { status: 400 });
    }
    const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    update.coins = Math.max(0, (user.coins || 0) + delta);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const result = await db
    .collection("users")
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after", projection: { passwordHash: 0 } }
    );

  if (!result) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    ...result,
    _id: result._id.toString(),
  });
}
