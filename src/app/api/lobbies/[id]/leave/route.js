import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/lobbies/[id]/leave — выйти из лобби
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || !["waiting", "active"].includes(lobby.status)) {
    return NextResponse.json({ error: "Лобби не найдено" }, { status: 404 });
  }

  const userId = auth.user._id.toString();

  // Если хост уходит — лобби распускается
  if (lobby.hostId === userId) {
    await db.collection("lobbies").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "completed" } }
    );
    return NextResponse.json({ ok: true, disbanded: true });
  }

  // Иначе просто удаляем участника
  await db.collection("lobbies").updateOne(
    { _id: new ObjectId(id) },
    { $pull: { participants: { userId } } }
  );

  return NextResponse.json({ ok: true, disbanded: false });
}
