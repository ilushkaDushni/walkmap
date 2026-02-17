import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { ALL_PERMISSIONS, invalidateRolesCache, isSuperadmin } from "@/lib/permissions";
import { checkAndGrantAchievements } from "@/lib/achievementEngine";

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
      // Обновляем системные роли (позиция, права, цвет)
      await db.collection("roles").updateOne(
        { _id: existing._id },
        { $set: { position: seed.position, permissions: seed.permissions, color: seed.color, name: seed.name, isSystem: true, isDefault: seed.isDefault, updatedAt: now } }
      );
      roleIdMap[seed.slug] = existing._id;
      log.push(`Роль "${seed.slug}" обновлена`);
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

  // 2. Перемаппинг ВСЕХ юзеров по полю role → roles
  const allUsers = await db.collection("users").find({}).toArray();

  let migratedCount = 0;
  for (const u of allUsers) {
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

  log.push(`Обновлено ${migratedCount} юзеров`);

  invalidateRolesCache();

  // 3. Ретроактивная выдача достижений (без начисления монет)
  let achievementsGranted = 0;
  for (const u of allUsers) {
    const { newAchievements } = await checkAndGrantAchievements(u._id, { grantReward: false });
    achievementsGranted += newAchievements.length;
  }
  log.push(`Выдано ${achievementsGranted} достижений ретроактивно (без монет)`);

  // 4. Создаём уникальные индексы для ролей
  await db.collection("roles").createIndex({ slug: 1 }, { unique: true });
  await db.collection("roles").createIndex({ name: 1 }, { unique: true });
  log.push("Индексы ролей созданы");

  // 5. Миграция комментариев: добавляем parentId: null к существующим
  const commentsUpdated = await db.collection("comments").updateMany(
    { parentId: { $exists: false } },
    { $set: { parentId: null } }
  );
  log.push(`Обновлено ${commentsUpdated.modifiedCount} комментариев (parentId: null)`);

  // 6. Индексы для комментариев
  await db.collection("comments").createIndex({ routeId: 1, parentId: 1, createdAt: -1 });
  await db.collection("comments").createIndex({ parentId: 1, createdAt: 1 });
  log.push("Индексы комментариев созданы");

  // 7. Индексы для уведомлений
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("notifications").createIndex({ userId: 1, read: 1 });
  await db.collection("notifications").createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 30 * 24 * 60 * 60 } // TTL 30 дней
  );
  log.push("Индексы уведомлений созданы (+ TTL 30 дней)");

  // 8. Индексы для дружбы
  await db.collection("friendships").createIndex({ users: 1 });
  await db.collection("friendships").createIndex({ users: 1, status: 1 });
  await db.collection("friendships").createIndex({ requesterId: 1, status: 1 });
  log.push("Индексы дружбы созданы");

  // 9. Индексы для сообщений
  // Убираем старый TTL индекс (сообщения хранятся вечно)
  try {
    await db.collection("messages").dropIndex("createdAt_1");
    log.push("TTL индекс messages (createdAt_1) удалён");
  } catch {
    log.push("TTL индекс messages (createdAt_1) не найден, пропуск");
  }
  await db.collection("messages").createIndex({ conversationKey: 1, createdAt: -1 });
  await db.collection("messages").createIndex({ senderId: 1 });
  log.push("Индексы сообщений созданы (без TTL)");

  // 10. Индексы для лобби
  await db.collection("lobbies").createIndex({ joinCode: 1, status: 1 });
  await db.collection("lobbies").createIndex({ hostId: 1, status: 1 });
  await db.collection("lobbies").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 } // TTL по полю expiresAt
  );
  log.push("Индексы лобби созданы (+ TTL по expiresAt)");

  // 11. Индексы для coin_transactions
  await db.collection("coin_transactions").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("coin_transactions").createIndex({ type: 1, createdAt: -1 });
  await db.collection("coin_transactions").createIndex({ createdAt: -1 });
  log.push("Индексы coin_transactions созданы");

  // 12. Индекс для глобальной сортировки комментариев в админке
  await db.collection("comments").createIndex({ createdAt: -1 });
  log.push("Индекс comments.createdAt созданы");

  // 13. Конвертация S3 URL → proxy URL для avatarUrl
  const s3Prefix = "https://storage.yandexcloud.net/";
  const usersWithS3Avatar = await db.collection("users").find({
    avatarUrl: { $regex: `^${s3Prefix}` },
  }).toArray();

  let avatarsMigrated = 0;
  for (const u of usersWithS3Avatar) {
    const rest = u.avatarUrl.slice(s3Prefix.length);
    const idx = rest.indexOf("/");
    if (idx !== -1) {
      const proxyUrl = `/api/media/${rest.slice(idx + 1)}`;
      await db.collection("users").updateOne(
        { _id: u._id },
        { $set: { avatarUrl: proxyUrl } }
      );
      avatarsMigrated++;
    }
  }
  log.push(`Конвертировано ${avatarsMigrated} avatarUrl (S3 → proxy)`);

  return NextResponse.json({ success: true, log });
}
