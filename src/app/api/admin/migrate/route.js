import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { ALL_PERMISSIONS, invalidateRolesCache, isSuperadmin } from "@/lib/permissions";

// POST /api/admin/migrate — seed ролей + маппинг user.role → user.roles
export async function POST(request) {
  const { user, error } = await requirePermission(request, "admin.access");
  if (error) return error;

  // Только суперадмин может запускать миграцию
  if (!isSuperadmin(user)) {
    return NextResponse.json({ error: "Только суперадмин может запустить миграцию" }, { status: 403 });
  }

  const db = await getDb();
  const now = new Date();
  const log = [];

  // 1. Seed-роли
  const seedRoles = [
    {
      name: "Админ",
      slug: "admin",
      color: "#3b82f6",
      position: 1,
      permissions: [...ALL_PERMISSIONS],
      isDefault: false,
      isSystem: true,
    },
    {
      name: "Модератор",
      slug: "moderator",
      color: "#ef4444",
      position: 2,
      permissions: [
        "admin.access", "routes.create", "routes.edit", "routes.delete",
        "routes.view_hidden", "folders.create", "folders.edit", "folders.delete",
        "folders.visibility", "users.view", "upload.files",
      ],
      isDefault: false,
      isSystem: true,
    },
    {
      name: "Пользователь",
      slug: "user",
      color: "#22c55e",
      position: 3,
      permissions: [],
      isDefault: true,
      isSystem: true,
    },
  ];

  const roleIdMap = {}; // slug → ObjectId

  for (const seed of seedRoles) {
    const existing = await db.collection("roles").findOne({ slug: seed.slug });
    if (existing) {
      roleIdMap[seed.slug] = existing._id;
      log.push(`Роль "${seed.slug}" уже существует, пропускаем`);
    } else {
      const result = await db.collection("roles").insertOne({
        ...seed,
        createdAt: now,
        updatedAt: now,
      });
      roleIdMap[seed.slug] = result.insertedId;
      log.push(`Создана роль "${seed.slug}"`);
    }
  }

  // 2. Маппинг user.role → user.roles (только юзеры без поля roles)
  const usersToMigrate = await db.collection("users").find({
    $or: [
      { roles: { $exists: false } },
      { roles: null },
    ],
  }).toArray();

  let migratedCount = 0;
  for (const u of usersToMigrate) {
    const oldRole = u.role || "user";
    const roleId = roleIdMap[oldRole];
    if (roleId) {
      await db.collection("users").updateOne(
        { _id: u._id },
        { $set: { roles: [roleId] } }
      );
      migratedCount++;
    }
  }

  log.push(`Мигрировано ${migratedCount} юзеров`);

  invalidateRolesCache();

  // 3. Создаём уникальные индексы
  await db.collection("roles").createIndex({ slug: 1 }, { unique: true });
  await db.collection("roles").createIndex({ name: 1 }, { unique: true });
  log.push("Индексы созданы");

  return NextResponse.json({ success: true, log });
}
