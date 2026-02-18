import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const USERNAME_CHANGE_COST = 50;

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { username } = await request.json();

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Ник обязателен" }, { status: 400 });
  }

  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 20) {
    return NextResponse.json({ error: "Ник должен быть от 2 до 20 символов" }, { status: 400 });
  }

  if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(trimmed)) {
    return NextResponse.json({ error: "Допустимы буквы, цифры и _" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id;

  // Проверка уникальности (case-insensitive)
  const existing = await db.collection("users").findOne({
    username: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    _id: { $ne: userId },
  });

  if (existing) {
    return NextResponse.json({ error: "Этот ник уже занят" }, { status: 409 });
  }

  // Первая смена бесплатно, потом 50 монет
  const isFreeChange = !auth.user.usernameChangedAt;

  if (!isFreeChange) {
    const coins = auth.user.coins || 0;
    if (coins < USERNAME_CHANGE_COST) {
      return NextResponse.json(
        { error: `Недостаточно монет. Нужно ${USERNAME_CHANGE_COST}, у вас ${coins}` },
        { status: 400 }
      );
    }

    // Атомарное списание
    const result = await db.collection("users").updateOne(
      { _id: userId, coins: { $gte: USERNAME_CHANGE_COST } },
      {
        $set: { username: trimmed, usernameChangedAt: new Date() },
        $inc: { coins: -USERNAME_CHANGE_COST },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: "Недостаточно монет" }, { status: 400 });
    }

    const updated = await db.collection("users").findOne({ _id: userId });
    return NextResponse.json({ username: updated.username, coins: updated.coins });
  }

  // Бесплатная смена
  await db.collection("users").updateOne(
    { _id: userId },
    { $set: { username: trimmed, usernameChangedAt: new Date() } }
  );

  return NextResponse.json({ username: trimmed, coins: auth.user.coins || 0 });
}
