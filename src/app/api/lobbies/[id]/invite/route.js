import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";

// POST /api/lobbies/[id]/invite — пригласить друга
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const { friendId } = await request.json();

  if (!ObjectId.isValid(id) || !ObjectId.isValid(friendId)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || !["waiting"].includes(lobby.status)) {
    return NextResponse.json({ error: "Лобби не найдено или уже начато" }, { status: 404 });
  }

  if (lobby.hostId !== auth.user._id.toString()) {
    return NextResponse.json({ error: "Только хост может приглашать" }, { status: 403 });
  }

  // Проверяем дружбу
  const userId = auth.user._id.toString();
  const users = [userId, friendId].sort();
  const friendship = await db.collection("friendships").findOne({
    users,
    status: "accepted",
  });

  if (!friendship) {
    return NextResponse.json({ error: "Можно приглашать только друзей" }, { status: 403 });
  }

  // Получаем данные маршрута
  const route = await db.collection("routes").findOne({ _id: new ObjectId(lobby.routeId) });

  // Уведомление
  await createNotification(friendId, "lobby_invite", {
    lobbyId: id,
    joinCode: lobby.joinCode,
    routeId: lobby.routeId,
    routeTitle: route?.title || "",
    username: auth.user.username,
    avatarUrl: auth.user.avatarUrl || null,
  });

  return NextResponse.json({ ok: true });
}
