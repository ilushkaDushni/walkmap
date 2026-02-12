import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { ObjectId } from "mongodb";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id;

    const userIdStr = userId.toString();
    const gpsFilter = { userId: userIdStr, gpsVerified: true };
    const nightHoursUTC = [21, 22, 23, 0, 1];

    const [completedRoutes, distAgg, commentsCount, nightDoc] = await Promise.all([
      db.collection("completed_routes").countDocuments(gpsFilter),
      db.collection("completed_routes").aggregate([
        { $match: gpsFilter },
        { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
        { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
        { $unwind: "$route" },
        { $group: { _id: null, total: { $sum: "$route.distance" } } },
      ]).toArray(),
      db.collection("comments").countDocuments({ userId: userIdStr }),
      db.collection("completed_routes").findOne({
        ...gpsFilter,
        $expr: { $in: [{ $hour: "$completedAt" }, nightHoursUTC] },
      }),
    ]);

    return NextResponse.json({
      completedRoutes,
      totalDistanceM: distAgg[0]?.total || 0,
      coins: auth.user.coins || 0,
      commentsCount,
      hasNightCompletion: nightDoc !== null,
      achievements: (auth.user.achievements || []).map((a) => a.slug),
    });
  } catch (e) {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
