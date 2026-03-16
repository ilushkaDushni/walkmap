import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { haversineDistance, projectPointOnPath, progressFromProjection, cumulativeDistances } from "@/lib/geo";

// POST /api/lobbies/[id]/finish-race — участник финишировал
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || lobby.status !== "active" || lobby.type !== "race") {
    return NextResponse.json({ error: "Гонка не найдена или неактивна" }, { status: 404 });
  }

  if (!lobby.participants.some((p) => p.userId === userId)) {
    return NextResponse.json({ error: "Вы не участник" }, { status: 403 });
  }

  // Проверяем не финишировал ли уже
  const alreadyFinished = lobby.raceState?.finishedParticipants?.some((p) => p.userId === userId);
  if (alreadyFinished) {
    return NextResponse.json({ error: "Вы уже финишировали" }, { status: 400 });
  }

  const body = await request.json();
  const position = body.position;
  if (!position?.lat || !position?.lng) {
    return NextResponse.json({ error: "Позиция обязательна" }, { status: 400 });
  }

  // Загружаем маршрут для валидации финиша
  const route = await db.collection("routes").findOne({ _id: new ObjectId(lobby.routeId) });
  if (!route?.path?.length) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 500 });
  }

  // Определяем финишную точку
  const finishIdx = route.finishPointIndex ?? (route.path.length - 1);
  const finishPoint = route.path[finishIdx];

  // Валидация: позиция < 50м от финиша
  const distToFinish = haversineDistance(
    { lat: Number(position.lat), lng: Number(position.lng) },
    finishPoint
  );
  if (distToFinish > 50) {
    return NextResponse.json({ error: "Слишком далеко от финиша" }, { status: 400 });
  }

  // Валидация: progress >= 0.95
  const participantState = lobby.participantStates?.[userId];
  const serverProgress = participantState?.progress || 0;
  if (serverProgress < 0.95) {
    return NextResponse.json({ error: "Пройдите весь маршрут" }, { status: 400 });
  }

  const now = new Date();
  const startedAt = lobby.raceState?.startedAt ? new Date(lobby.raceState.startedAt) : new Date(lobby.createdAt);
  const duration = Math.round((now.getTime() - startedAt.getTime()) / 1000);
  const pace = route.distance > 0 ? Math.round(duration / (route.distance / 1000)) : null;
  const place = (lobby.raceState?.finishedParticipants?.length || 0) + 1;

  const finishEntry = {
    userId,
    finishedAt: now,
    duration,
    pace,
    place,
  };

  await db.collection("lobbies").updateOne(
    { _id: new ObjectId(id) },
    {
      $push: { "raceState.finishedParticipants": finishEntry },
      $set: {
        [`participantStates.${userId}.finishedAt`]: now,
        [`participantStates.${userId}.progress`]: 1,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    place,
    duration,
    pace,
    totalFinished: place,
    totalParticipants: lobby.participants.length,
  });
}
