import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/lobbies/[id] — состояние лобби (polling endpoint)
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby) {
    return NextResponse.json({ error: "Лобби не найдено" }, { status: 404 });
  }

  // Проверяем что юзер участник
  const userId = auth.user._id.toString();
  const isParticipant = lobby.participants.some((p) => p.userId === userId);
  if (!isParticipant) {
    return NextResponse.json({ error: "Вы не участник этого лобби" }, { status: 403 });
  }

  // Проверяем heartbeat хоста
  const hostStateAge = Date.now() - new Date(lobby.hostState?.updatedAt || 0).getTime();
  const hostOffline = lobby.status === "active" && hostStateAge > 30000;

  // Получаем данные маршрута
  const route = await db.collection("routes").findOne({ _id: new ObjectId(lobby.routeId) });

  return NextResponse.json({
    id: lobby._id.toString(),
    routeId: lobby.routeId,
    routeTitle: route?.title || "",
    hostId: lobby.hostId,
    joinCode: lobby.joinCode,
    status: lobby.status,
    participants: lobby.participants,
    maxParticipants: lobby.maxParticipants,
    hostState: lobby.hostState,
    hostOffline,
    createdAt: lobby.createdAt,
  });
}
