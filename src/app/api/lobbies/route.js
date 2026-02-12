import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import crypto from "crypto";

function generateJoinCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 символов
}

// POST /api/lobbies — создать лобби
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { routeId } = await request.json();

  if (!routeId || !ObjectId.isValid(routeId)) {
    return NextResponse.json({ error: "Некорректный ID маршрута" }, { status: 400 });
  }

  const db = await getDb();

  // Проверяем что маршрут существует
  const route = await db.collection("routes").findOne({ _id: new ObjectId(routeId) });
  if (!route) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  // Проверяем что у юзера нет активного лобби
  const existing = await db.collection("lobbies").findOne({
    hostId: auth.user._id.toString(),
    status: { $in: ["waiting", "active"] },
  });
  if (existing) {
    return NextResponse.json({ error: "У вас уже есть активное лобби" }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 часа

  // Генерируем уникальный код
  let joinCode;
  for (let i = 0; i < 10; i++) {
    joinCode = generateJoinCode();
    const dup = await db.collection("lobbies").findOne({ joinCode, status: { $in: ["waiting", "active"] } });
    if (!dup) break;
  }

  const lobby = {
    routeId: routeId,
    hostId: auth.user._id.toString(),
    joinCode,
    status: "waiting",
    participants: [{
      userId: auth.user._id.toString(),
      username: auth.user.username,
      avatarUrl: auth.user.avatarUrl || null,
      joinedAt: now,
    }],
    maxParticipants: 5,
    hostState: {
      position: null,
      progress: 0,
      triggeredCheckpointIds: [],
      totalCoins: 0,
      audio: { isPlaying: false, trackIndex: 0, currentTime: 0, updatedAt: now },
      updatedAt: now,
    },
    createdAt: now,
    expiresAt,
  };

  const result = await db.collection("lobbies").insertOne(lobby);

  return NextResponse.json({
    id: result.insertedId.toString(),
    joinCode,
    status: "waiting",
    routeId,
    routeTitle: route.title || "",
    participants: lobby.participants,
  }, { status: 201 });
}
