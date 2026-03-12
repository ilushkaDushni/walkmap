import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/gps-tracks — начать запись трека
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { routeId, startPosition } = await request.json();
  const userId = auth.user._id.toString();
  const db = await getDb();

  // Проверяем что нет активной записи
  const existing = await db.collection("gps_tracks").findOne({
    userId,
    status: "recording",
  });
  if (existing) {
    return NextResponse.json(
      { error: "Уже есть активная запись", trackId: existing._id.toString() },
      { status: 409 }
    );
  }

  const now = new Date();
  const points = [];
  if (startPosition?.lat && startPosition?.lng) {
    points.push({
      lat: Number(startPosition.lat),
      lng: Number(startPosition.lng),
      timestamp: now,
    });
  }

  const track = {
    userId,
    routeId: routeId || null,
    points,
    distance: 0,
    duration: 0,
    status: "recording",
    startedAt: now,
    finishedAt: null,
  };

  const result = await db.collection("gps_tracks").insertOne(track);

  // Ставим статус "на маршруте" в профиле
  await db.collection("users").updateOne(
    { _id: auth.user._id },
    {
      $set: {
        trackingStatus: {
          active: true,
          routeId: routeId || null,
          trackId: result.insertedId.toString(),
          startedAt: now,
        },
        lastActivityAt: now,
      },
    }
  );

  return NextResponse.json(
    { trackId: result.insertedId.toString(), startedAt: now },
    { status: 201 }
  );
}

// GET /api/gps-tracks — список треков пользователя
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const userId = auth.user._id.toString();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
  const before = searchParams.get("before");

  const db = await getDb();
  const filter = { userId, status: "finished" };
  if (before) {
    filter.finishedAt = { $lt: new Date(before) };
  }

  const tracks = await db.collection("gps_tracks")
    .find(filter)
    .sort({ finishedAt: -1 })
    .limit(limit + 1)
    .toArray();

  const hasMore = tracks.length > limit;
  const items = (hasMore ? tracks.slice(0, limit) : tracks).map((t) => ({
    id: t._id.toString(),
    routeId: t.routeId,
    distance: t.distance,
    duration: t.duration,
    pointsCount: t.points.length,
    startedAt: t.startedAt,
    finishedAt: t.finishedAt,
  }));

  return NextResponse.json({ tracks: items, hasMore });
}
