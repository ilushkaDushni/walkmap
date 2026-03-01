import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";
import { pushNotification } from "@/lib/sse";

// POST /api/friends/request — отправить заявку в друзья
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { targetUserId } = await request.json();

  if (!targetUserId || !ObjectId.isValid(targetUserId)) {
    return NextResponse.json({ error: "Некорректный ID пользователя" }, { status: 400 });
  }

  const userId = auth.user._id.toString();

  if (targetUserId === userId) {
    return NextResponse.json({ error: "Нельзя добавить себя в друзья" }, { status: 400 });
  }

  const db = await getDb();

  // Проверяем что целевой юзер существует
  const targetUser = await db.collection("users").findOne({ _id: new ObjectId(targetUserId) });
  if (!targetUser) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  // Сортируем ID лексикографически для уникальности пары
  const users = [userId, targetUserId].sort();

  // Проверяем существующую дружбу
  const existing = await db.collection("friendships").findOne({ users });

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Вы уже друзья" }, { status: 400 });
    }
    if (existing.status === "pending") {
      // Если заявка уже есть от другого пользователя — автоматически принимаем
      if (existing.requesterId !== userId) {
        await db.collection("friendships").updateOne(
          { _id: existing._id },
          { $set: { status: "accepted", acceptedAt: new Date() } }
        );

        const acceptData = {
          userId,
          username: auth.user.username,
          avatarUrl: auth.user.avatarUrl || null,
        };
        await createNotification(existing.requesterId, "friend_accept", acceptData);
        pushNotification(existing.requesterId, { type: "friend_accept", ...acceptData });

        return NextResponse.json({ status: "accepted", message: "Заявка принята — вы теперь друзья!" });
      }
      return NextResponse.json({ error: "Заявка уже отправлена" }, { status: 400 });
    }
  }

  // Создаём новую заявку
  await db.collection("friendships").insertOne({
    users,
    status: "pending",
    requesterId: userId,
    createdAt: new Date(),
    acceptedAt: null,
  });

  // Уведомление целевому юзеру
  const requestData = {
    userId,
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
  };
  await createNotification(targetUserId, "friend_request", requestData);
  pushNotification(targetUserId, { type: "friend_request", ...requestData });

  return NextResponse.json({ status: "pending", message: "Заявка отправлена" }, { status: 201 });
}
