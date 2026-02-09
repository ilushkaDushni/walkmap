import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { PERMISSION_REGISTRY, ALL_PERMISSIONS, invalidateRolesCache, getTopPosition, isSuperadmin } from "@/lib/permissions";

// GET /api/admin/roles — список всех ролей + userCount
export async function GET(request) {
  const { error } = await requirePermission(request, "admin.access");
  if (error) return error;

  const db = await getDb();
  const roles = await db.collection("roles").find({}).sort({ position: 1 }).toArray();

  // Считаем юзеров на каждую роль
  const users = await db.collection("users").find(
    { roles: { $exists: true, $ne: [] } },
    { projection: { roles: 1 } }
  ).toArray();

  const countMap = {};
  for (const u of users) {
    for (const rid of (u.roles || [])) {
      const key = rid.toString();
      countMap[key] = (countMap[key] || 0) + 1;
    }
  }

  const result = roles.map((r) => ({
    _id: r._id.toString(),
    name: r.name,
    slug: r.slug,
    color: r.color,
    position: r.position,
    permissions: r.permissions,
    isDefault: r.isDefault || false,
    isSystem: r.isSystem || false,
    userCount: countMap[r._id.toString()] || 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return NextResponse.json(result);
}

// POST /api/admin/roles — создать роль
export async function POST(request) {
  const { user, error } = await requirePermission(request, "roles.manage");
  if (error) return error;

  const body = await request.json();
  const { name, slug, color, position, permissions, isDefault } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
  }

  const slugVal = (slug || name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!slugVal) {
    return NextResponse.json({ error: "Невалидный slug" }, { status: 400 });
  }

  // Валидация permissions
  const perms = (permissions || []).filter((p) => ALL_PERMISSIONS.includes(p));

  // Позиция: не выше своего максимума (кроме суперадмина)
  const callerTopPos = await getTopPosition(user);
  const pos = Number(position) || 5;
  if (pos <= callerTopPos && !isSuperadmin(user)) {
    return NextResponse.json({ error: "Позиция слишком высокая" }, { status: 403 });
  }

  const db = await getDb();

  // Уникальность name и slug
  const existing = await db.collection("roles").findOne({
    $or: [{ name: name.trim() }, { slug: slugVal }],
  });
  if (existing) {
    return NextResponse.json({ error: "Роль с таким именем или slug уже существует" }, { status: 409 });
  }

  const now = new Date();
  const doc = {
    name: name.trim(),
    slug: slugVal,
    color: color || "#6b7280",
    position: pos,
    permissions: perms,
    isDefault: !!isDefault,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("roles").insertOne(doc);
  invalidateRolesCache();

  return NextResponse.json({ ...doc, _id: result.insertedId.toString() }, { status: 201 });
}
