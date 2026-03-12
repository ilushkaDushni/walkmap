import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

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

  if (body.position) {
    update[`participantStates.${userId}.position`] = {
      lat: Number(body.position.lat),
      lng: Number(body.position.lng),
    };
  }
  if (body.progress !== undefined) {
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
