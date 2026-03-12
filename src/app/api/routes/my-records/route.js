import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/routes/my-records — лучшие времена текущего юзера по всем маршрутам
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    const records = await db.collection("completed_routes")
      .find({ userId, duration: { $gt: 0 }, gpsVerified: true })
      .project({ routeId: 1, duration: 1, _id: 0 })
      .toArray();

    // Map: routeId -> duration (лучшее время)
    const best = {};
    for (const r of records) {
      if (!best[r.routeId] || r.duration < best[r.routeId]) {
        best[r.routeId] = r.duration;
      }
    }

    return NextResponse.json(best);
  } catch {
    return NextResponse.json({});
  }
}
