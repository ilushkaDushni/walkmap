import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// PATCH /api/lobbies/[id]/host-state — хост обновляет GPS + аудио
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || lobby.status !== "active") {
    return NextResponse.json({ error: "Лобби не найдено или неактивно" }, { status: 404 });
  }

  if (lobby.hostId !== auth.user._id.toString()) {
    return NextResponse.json({ error: "Только хост может обновлять состояние" }, { status: 403 });
  }

  const body = await request.json();
  const now = new Date();

  const update = { "hostState.updatedAt": now };

  if (body.position) {
    update["hostState.position"] = {
      lat: Number(body.position.lat),
      lng: Number(body.position.lng),
    };
  }
  if (body.progress !== undefined) {
    update["hostState.progress"] = Math.max(0, Math.min(1, Number(body.progress)));
  }
  if (body.triggeredCheckpointIds) {
    update["hostState.triggeredCheckpointIds"] = body.triggeredCheckpointIds;
  }
  if (body.totalCoins !== undefined) {
    update["hostState.totalCoins"] = Number(body.totalCoins);
  }
  if (body.audio) {
    update["hostState.audio"] = {
      isPlaying: !!body.audio.isPlaying,
      trackIndex: Number(body.audio.trackIndex || 0),
      currentTime: Number(body.audio.currentTime || 0),
      updatedAt: now,
    };
  }

  await db.collection("lobbies").updateOne(
    { _id: new ObjectId(id) },
    { $set: update }
  );

  return NextResponse.json({ ok: true });
}
