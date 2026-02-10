import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();

    const [totalRoutes, distAgg, totalUsers] = await Promise.all([
      db.collection("routes").countDocuments({ status: "published" }),
      db.collection("routes").aggregate([
        { $match: { status: "published" } },
        { $group: { _id: null, total: { $sum: "$distance" } } },
      ]).toArray(),
      db.collection("users").countDocuments(),
    ]);

    return NextResponse.json({
      totalRoutes,
      totalDistanceM: distAgg[0]?.total || 0,
      totalUsers,
    });
  } catch (e) {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
