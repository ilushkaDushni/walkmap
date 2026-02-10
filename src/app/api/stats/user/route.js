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

    const [completedRoutes, distAgg] = await Promise.all([
      db.collection("completed_routes").countDocuments({ userId: userId.toString() }),
      db.collection("completed_routes").aggregate([
        { $match: { userId: userId.toString() } },
        { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
        { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
        { $unwind: "$route" },
        { $group: { _id: null, total: { $sum: "$route.distance" } } },
      ]).toArray(),
    ]);

    return NextResponse.json({
      completedRoutes,
      totalDistanceM: distAgg[0]?.total || 0,
      coins: auth.user.coins || 0,
    });
  } catch (e) {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
