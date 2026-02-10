import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

export async function GET(request) {
  const { error } = await requirePermission(request, "admin.access");
  if (error) return error;

  const db = await getDb();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newWeek,
    activeWeek,
    coinsAgg,
    published,
    drafts,
    distanceAgg,
    durationAgg,
    totalCompletions,
    topRouteAgg,
    topUserAgg,
  ] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("users").countDocuments({ createdAt: { $gte: weekAgo } }),
    db.collection("users").countDocuments({ lastLoginAt: { $gte: weekAgo } }),
    db.collection("users").aggregate([
      { $group: { _id: null, total: { $sum: "$coins" } } },
    ]).toArray(),
    db.collection("routes").countDocuments({ status: "published" }),
    db.collection("routes").countDocuments({ status: "draft" }),
    db.collection("routes").aggregate([
      { $match: { status: "published" } },
      { $group: { _id: null, total: { $sum: "$distance" } } },
    ]).toArray(),
    db.collection("routes").aggregate([
      { $match: { status: "published" } },
      { $group: { _id: null, avg: { $avg: "$duration" } } },
    ]).toArray(),
    db.collection("completed_routes").countDocuments(),
    db.collection("completed_routes").aggregate([
      { $group: { _id: "$routeId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $lookup: { from: "routes", localField: "_id", foreignField: "_id", as: "route" } },
      { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
      { $project: { count: 1, title: { $ifNull: ["$route.title", "Неизвестный"] } } },
    ]).toArray(),
    db.collection("completed_routes").aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { count: 1, username: { $ifNull: ["$user.username", "Неизвестный"] } } },
    ]).toArray(),
  ]);

  return NextResponse.json({
    users: {
      total: totalUsers,
      newWeek,
      activeWeek,
      totalCoins: coinsAgg[0]?.total || 0,
    },
    routes: {
      published,
      drafts,
      totalDistanceM: distanceAgg[0]?.total || 0,
      avgDurationMin: Math.round(durationAgg[0]?.avg || 0),
    },
    completions: {
      total: totalCompletions,
      topRoute: topRouteAgg[0]
        ? { title: topRouteAgg[0].title, count: topRouteAgg[0].count }
        : null,
      topUser: topUserAgg[0]
        ? { username: topUserAgg[0].username, count: topUserAgg[0].count }
        : null,
    },
  });
}
