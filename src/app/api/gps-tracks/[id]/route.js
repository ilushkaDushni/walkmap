import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { haversineDistance } from "@/lib/geo";

// GET /api/gps-tracks/[id] — получить трек
export async function GET(request, { params }) {
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

  return NextResponse.json({
    id: track._id.toString(),
    routeId: track.routeId,
    points: track.points,
    distance: track.distance,
    duration: track.duration,
    status: track.status,
    startedAt: track.startedAt,
    finishedAt: track.finishedAt,
  });
}

// PATCH /api/gps-tracks/[id] — добавить точки к треку
export async function PATCH(request, { params }) {
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

  const { points } = await request.json();

  if (!Array.isArray(points) || points.length === 0) {
    return NextResponse.json({ error: "Нужен массив точек" }, { status: 400 });
  }

  // Валидируем и форматируем точки
  const now = new Date();
  const newPoints = points.slice(0, 100).map((p) => ({
    lat: Number(p.lat),
    lng: Number(p.lng),
    timestamp: p.timestamp ? new Date(p.timestamp) : now,
  }));

  // Считаем добавочное расстояние
  let addedDistance = 0;
  const allPoints = [...track.points, ...newPoints];
  const startIdx = Math.max(0, track.points.length - 1);
  for (let i = startIdx; i < allPoints.length - 1; i++) {
    if (i >= track.points.length - 1) {
      addedDistance += haversineDistance(allPoints[i], allPoints[i + 1]);
    }
  }

  await db.collection("gps_tracks").updateOne(
    { _id: new ObjectId(id) },
    {
      $push: { points: { $each: newPoints } },
      $inc: { distance: addedDistance },
    }
  );

  // Обновляем lastActivityAt
  await db.collection("users").updateOne(
    { _id: auth.user._id },
    { $set: { lastActivityAt: now } }
  );

  return NextResponse.json({
    ok: true,
    totalPoints: track.points.length + newPoints.length,
    distance: track.distance + addedDistance,
  });
}
