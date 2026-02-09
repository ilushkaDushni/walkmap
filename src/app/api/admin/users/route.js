import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminAuth";

// GET /api/admin/users?q=search&sort=createdAt&order=desc
export async function GET(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const sortField = searchParams.get("sort") || "createdAt";
  const sortOrder = searchParams.get("order") === "asc" ? 1 : -1;

  const db = await getDb();

  const filter = q
    ? { username: { $regex: q, $options: "i" } }
    : {};

  const allowedSorts = ["createdAt", "username", "coins", "lastLoginAt"];
  const sort = allowedSorts.includes(sortField)
    ? { [sortField]: sortOrder }
    : { createdAt: -1 };

  const users = await db
    .collection("users")
    .find(filter, {
      projection: {
        passwordHash: 0,
      },
    })
    .sort(sort)
    .toArray();

  // Считаем пройденные маршруты для каждого юзера
  const stats = await db
    .collection("completed_routes")
    .aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ])
    .toArray();

  const completedMap = {};
  for (const s of stats) {
    completedMap[s._id] = s.count;
  }

  const result = users.map((u) => ({
    _id: u._id.toString(),
    username: u.username || u.email || "—",
    email: u.email,
    role: u.role || "user",
    coins: u.coins || 0,
    banned: u.banned || false,
    completedRoutes: completedMap[u._id.toString()] || 0,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
  }));

  return NextResponse.json(result);
}
