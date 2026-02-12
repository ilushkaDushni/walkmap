import Link from "next/link";
import { ChevronLeft, Footprints, Ruler, Coins, Trophy, Shield } from "lucide-react";
import { ACHIEVEMENT_REGISTRY, COLOR_CLASSES, ICON_MAP_KEYS } from "@/lib/achievements";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

async function fetchProfile(username) {
  const { getDb } = await import("@/lib/mongodb");
  const { resolveUserRolesData } = await import("@/lib/permissions");

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
  );

  if (!user || user.banned) return null;

  const roles = await resolveUserRolesData(user);

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

  const stats = { completedRoutes, totalDistanceM, coins: user.coins || 0 };
  const dbAchievements = (user.achievements || []).map((a) => a.slug || a);
  const computedAchievements = ACHIEVEMENT_REGISTRY.filter((a) => a.check(stats)).map((a) => a.slug);
  const achievements = [...new Set([...dbAchievements, ...computedAchievements])];

  return {
    id: user._id.toString(),
    username: user.username,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || "",
    createdAt: user.createdAt ? user.createdAt.toISOString() : null,
    roles,
    stats,
    achievements,
  };
}

export default async function UserProfilePage({ params }) {
  const { username } = await params;
  const profile = await fetchProfile(decodeURIComponent(username));

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-[var(--text-primary)]">Пользователь не найден</h1>
        <p className="mb-6 text-[var(--text-muted)]">Такого пользователя не существует</p>
        <Link
          href="/"
          className="rounded-lg bg-green-600 px-6 py-3 text-white transition hover:bg-green-700"
        >
          На главную
        </Link>
      </div>
    );
  }

  return (
    <ProfileClient profile={profile} />
  );
}
