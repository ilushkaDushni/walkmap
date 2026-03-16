import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { projectPointOnPath, progressFromProjection, cumulativeDistances, haversineDistance } from "@/lib/geo";

// PATCH /api/lobbies/[id]/participant-state — участник обновляет свой GPS
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || lobby.status !== "active") {
    return NextResponse.json({ error: "Лобби не найдено или неактивно" }, { status: 404 });
  }

  if (!lobby.participants.some((p) => p.userId === userId)) {
    return NextResponse.json({ error: "Вы не участник" }, { status: 403 });
  }

  const body = await request.json();
  const now = new Date();
  const update = {};
  const isRace = lobby.type === "race";

  if (body.position) {
    const pos = {
      lat: Number(body.position.lat),
      lng: Number(body.position.lng),
    };
    update[`participantStates.${userId}.position`] = pos;

    if (isRace) {
      // Anti-cheat: скорость между обновлениями
      const prevState = lobby.participantStates?.[userId];
      if (prevState?.position && prevState?.updatedAt) {
        const dt = (now.getTime() - new Date(prevState.updatedAt).getTime()) / 1000;
        if (dt > 0) {
          const dist = haversineDistance(prevState.position, pos);
          const speedKmh = (dist / dt) * 3.6;
          if (speedKmh > 30) {
            // Подозрительно быстро — игнорируем обновление позиции
            return NextResponse.json({ ok: true, warning: "speed_exceeded" });
          }
        }
      }

      // Серверный progress: вычисляем из GPS-проекции на маршрут
      const route = await db.collection("routes").findOne({ _id: new ObjectId(lobby.routeId) });
      if (route?.path?.length >= 2) {
        const projection = projectPointOnPath(pos, route.path);
        if (projection && projection.distance < 100) {
          const cumDist = cumulativeDistances(route.path);
          const serverProgress = progressFromProjection(projection, cumDist);

          // Не даём прогрессу уменьшаться (анти-чит: монотонность)
          const prevProgress = prevState?.progress || 0;
          const finalProgress = Math.max(prevProgress, serverProgress);
          update[`participantStates.${userId}.progress`] = Math.max(0, Math.min(1, finalProgress));
          update[`participantStates.${userId}.distance`] = projection.distance;
        }
      }
    }
  }

  // Для не-race лобби — клиент контролирует progress
  if (!isRace && body.progress !== undefined) {
    update[`participantStates.${userId}.progress`] = Math.max(0, Math.min(1, Number(body.progress)));
  }
  if (body.triggeredCheckpointIds) {
    update[`participantStates.${userId}.triggeredCheckpointIds`] = body.triggeredCheckpointIds;
  }
  update[`participantStates.${userId}.updatedAt`] = now;

  await db.collection("lobbies").updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );

  return NextResponse.json({ ok: true });
}
