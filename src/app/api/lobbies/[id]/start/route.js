import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/lobbies/[id]/start — хост запускает лобби
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || lobby.status !== "waiting") {
    return NextResponse.json({ error: "Лобби не найдено или уже начато" }, { status: 404 });
  }

  if (lobby.hostId !== auth.user._id.toString()) {
    return NextResponse.json({ error: "Только хост может запустить" }, { status: 403 });
  }

  await db.collection("lobbies").updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "active" } }
  );

  return NextResponse.json({ ok: true, status: "active" });
}
