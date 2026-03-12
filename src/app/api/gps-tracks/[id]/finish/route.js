import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/gps-tracks/[id]/finish — завершить запись трека
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const track = await db.collection("gps_tracks").findOne({ _id: new ObjectId(id) });

  if (!track || track.userId !== auth.user._id.toString()) {
    return NextResponse.json({ error: "Трек не найден" }, { status: 404 });
  }

  if (track.status !== "recording") {
    return NextResponse.json({ error: "Трек уже завершён" }, { status: 400 });
  }

  const now = new Date();
  const duration = Math.round((now - new Date(track.startedAt)) / 1000);

  await db.collection("gps_tracks").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "finished",
        finishedAt: now,
        duration,
      },
    }
  );

  // Убираем статус "на маршруте"
  await db.collection("users").updateOne(
    { _id: auth.user._id },
    {
      $set: {
        trackingStatus: null,
        lastActivityAt: now,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    distance: track.distance,
    duration,
    pointsCount: track.points.length,
    finishedAt: now,
  });
}
