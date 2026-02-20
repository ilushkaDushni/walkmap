import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { resolveUserRolesData } from "@/lib/permissions";
import { ACHIEVEMENT_REGISTRY } from "@/lib/achievements";

export async function GET(request, { params }) {
  const { username } = await params;

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
  );

  if (!user || user.banned) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  // Roles
  const roles = await resolveUserRolesData(user);

  // Stats from completed_routes (gpsVerified only)
  const completedRoutes = await db.collection("completed_routes").countDocuments({
    userId: user._id.toString(),
    gpsVerified: true,
  });

  const distAgg = await db.collection("completed_routes").aggregate([
    { $match: { userId: user._id.toString(), gpsVerified: true } },
    { $addFields: { routeObjId: { $toObjectId: "$routeId" } } },
    { $lookup: { from: "routes", localField: "routeObjId", foreignField: "_id", as: "route" } },
    { $unwind: "$route" },
    { $group: { _id: null, total: { $sum: "$route.distance" } } },
  ]).toArray();

  const totalDistanceM = distAgg[0]?.total || 0;

  // Achievements
  const stats = {
    completedRoutes,
    totalDistanceM,
    coins: user.coins || 0,
  };
  const dbAchievements = (user.achievements || []).map((a) => a.slug || a);
  const computedAchievements = ACHIEVEMENT_REGISTRY
    .filter((a) => a.check(stats))
    .map((a) => a.slug);
  const achievements = [...new Set([...dbAchievements, ...computedAchievements])];

  return NextResponse.json({
    username: user.username,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || "",
    createdAt: user.createdAt || null,
    lastActivityAt: user.lastActivityAt || null,
    roles,
    stats: { completedRoutes, totalDistanceM, coins: user.coins || 0 },
    achievements,
  });
}
