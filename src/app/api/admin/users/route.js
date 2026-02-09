import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { getAllRoles } from "@/lib/permissions";

// GET /api/admin/users?q=search&sort=createdAt&order=desc
export async function GET(request) {
  const { error } = await requirePermission(request, "users.view");
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

  // Загружаем роли для маппинга
  const allRoles = await getAllRoles();
  const rolesMap = {};
  for (const r of allRoles) {
    rolesMap[r._id.toString()] = {
      id: r._id.toString(),
      name: r.name,
      slug: r.slug,
      color: r.color,
      position: r.position,
    };
  }

  const result = users.map((u) => {
    // Резолвим роли юзера
    const userRoles = (u.roles || [])
      .map((rid) => rolesMap[rid.toString()])
      .filter(Boolean)
      .sort((a, b) => a.position - b.position);

    return {
      _id: u._id.toString(),
      username: u.username || u.email || "—",
      email: u.email,
      role: u.role || "user",
      roles: userRoles,
      roleIds: (u.roles || []).map((r) => r.toString()),
      coins: u.coins || 0,
      banned: u.banned || false,
      completedRoutes: completedMap[u._id.toString()] || 0,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || null,
    };
  });

  // Сортировка: юзеры с ролями выше (меньшая позиция) — первые
  result.sort((a, b) => {
    const posA = a.roles.length > 0 ? a.roles[0].position : Infinity;
    const posB = b.roles.length > 0 ? b.roles[0].position : Infinity;
    return posA - posB;
  });

  return NextResponse.json(result);
}
