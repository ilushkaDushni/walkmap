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
        "folders.visibility", "users.view", "upload.files", "shop.edit",
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

  // 13b. Дедупликация completed_routes + уникальный индекс
  const crDupes = await db.collection("completed_routes").aggregate([
    { $group: { _id: { userId: "$userId", routeId: "$routeId" }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  let crRemoved = 0;
  for (const d of crDupes) {
    const [, ...toRemove] = d.ids; // оставляем первый, удаляем остальные
    await db.collection("completed_routes").deleteMany({ _id: { $in: toRemove } });
    crRemoved += toRemove.length;
  }
  if (crRemoved > 0) log.push(`Удалено ${crRemoved} дубликатов completed_routes`);
  try {
    await db.collection("completed_routes").createIndex(
      { userId: 1, routeId: 1 },
      { unique: true }
    );
    log.push("Уникальный индекс completed_routes {userId, routeId} создан");
  } catch (e) {
    log.push(`Индекс completed_routes: ${e.message}`);
  }

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

  // 14. Составной индекс messages для инкрементального polling
  await db.collection("messages").createIndex({ conversationKey: 1, createdAt: 1 });
  log.push("Индекс messages {conversationKey, createdAt} для инкрементального polling создан");

  // 15. TTL-коллекция typing_indicators
  await db.collection("typing_indicators").createIndex(
    { updatedAt: 1 },
    { expireAfterSeconds: 10 }
  );
  await db.collection("typing_indicators").createIndex(
    { conversationKey: 1, userId: 1 },
    { unique: true }
  );
  log.push("Индексы typing_indicators созданы (TTL 10s)");

  // 16. Индексы для магазина
  await db.collection("shop_items").createIndex({ slug: 1 }, { unique: true });
  await db.collection("shop_items").createIndex({ category: 1, isActive: 1 });
  log.push("Индексы shop_items созданы");

  await db.collection("user_inventory").createIndex(
    { userId: 1, itemId: 1 },
    { unique: true }
  );
  log.push("Индекс user_inventory {userId, itemId} создан");

  await db.collection("currency_settings").createIndex({ key: 1 }, { unique: true });

  // Seed exchange_rate
  await db.collection("currency_settings").updateOne(
    { key: "exchange_rate" },
    { $setOnInsert: { key: "exchange_rate", value: 10, updatedAt: now } },
    { upsert: true }
  );
  log.push("currency_settings: exchange_rate = 10 (seed)");

  // 17. Seed товаров магазина
  const shopItems = [
    // ═══ РАМКИ ═══
    // --- Обычные (solid) ---
    {
      name: "Зелёная рамка",
      slug: "frame-green",
      category: "frame",
      description: "Простая зелёная рамка",
      price: 1,
      rarity: "common",
      cssData: { borderColor: "#22c55e", gradient: "#22c55e" },
      imageUrl: null,
    },
    {
      name: "Синяя рамка",
      slug: "frame-blue",
      category: "frame",
      description: "Спокойная синяя рамка",
      price: 1,
      rarity: "common",
      cssData: { borderColor: "#3b82f6", gradient: "#3b82f6" },
      imageUrl: null,
    },
    {
      name: "Розовая рамка",
      slug: "frame-pink",
      category: "frame",
      description: "Нежная розовая рамка",
      price: 1,
      rarity: "common",
      cssData: { borderColor: "#ec4899", gradient: "#ec4899" },
      imageUrl: null,
    },
    // --- Градиентные ---
    {
      name: "Закат",
      slug: "frame-gold",
      category: "frame",
      description: "Градиент тёплых тонов заката",
      price: 3,
      rarity: "rare",
      cssData: { borderColor: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #ef4444, #ec4899)" },
      imageUrl: null,
    },
    {
      name: "Аметист",
      slug: "frame-amethyst",
      category: "frame",
      description: "Переливы фиолетового и розового",
      price: 5,
      rarity: "rare",
      cssData: { borderColor: "#a855f7", gradient: "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)" },
      imageUrl: null,
    },
    {
      name: "Океан",
      slug: "frame-ocean",
      category: "frame",
      description: "Глубина океана — от бирюзового до синего",
      price: 5,
      rarity: "rare",
      cssData: { borderColor: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #3b82f6, #6366f1)" },
      imageUrl: null,
    },
    // --- Анимированные пульсация ---
    {
      name: "Ледяное сияние",
      slug: "frame-ice",
      category: "frame",
      description: "Мерцающий лёд с пульсирующим свечением",
      price: 8,
      rarity: "epic",
      cssData: { borderColor: "#06b6d4", gradient: "linear-gradient(135deg, #67e8f9, #06b6d4, #0e7490, #06b6d4, #67e8f9)", animation: "pulse" },
      imageUrl: null,
    },
    {
      name: "Токсичный",
      slug: "frame-toxic",
      category: "frame",
      description: "Ядовито-зелёное пульсирующее свечение",
      price: 8,
      rarity: "epic",
      cssData: { borderColor: "#22c55e", gradient: "linear-gradient(135deg, #4ade80, #22c55e, #15803d, #22c55e, #4ade80)", animation: "pulse" },
      imageUrl: null,
    },
    // --- Анимированные вращение ---
    {
      name: "Огненный вихрь",
      slug: "frame-fire",
      category: "frame",
      description: "Вращающееся пламя вокруг аватара",
      price: 10,
      rarity: "legendary",
      cssData: { borderColor: "#ef4444", gradient: "conic-gradient(#ef4444, #f97316, #eab308, #f97316, #ef4444)", animation: "spin" },
      imageUrl: null,
    },
    {
      name: "Радуга",
      slug: "frame-rainbow",
      category: "frame",
      description: "Анимированная вращающаяся радуга",
      price: 15,
      rarity: "legendary",
      cssData: { borderColor: "#ef4444", gradient: "conic-gradient(#ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ef4444)", animation: "spin" },
      imageUrl: null,
    },
    // --- Радуга hue-rotate ---
    {
      name: "Нитро",
      slug: "frame-nitro",
      category: "frame",
      description: "Переливающаяся радужная рамка в стиле Discord Nitro",
      price: 20,
      rarity: "legendary",
      cssData: { borderColor: "#a855f7", gradient: "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899)", animation: "rainbow" },
      imageUrl: null,
    },

    // ═══ ТИТУЛЫ ═══
    {
      name: "Ходок",
      slug: "title-walker",
      category: "title",
      description: "Простой титул для начинающего путешественника",
      price: 1,
      rarity: "common",
      cssData: { text: "Ходок", color: "#6b7280" },
      imageUrl: null,
    },
    {
      name: "Турист",
      slug: "title-tourist",
      category: "title",
      description: "Вы любите гулять по городу",
      price: 1,
      rarity: "common",
      cssData: { text: "Турист", color: "#22c55e" },
      imageUrl: null,
    },
    {
      name: "Следопыт",
      slug: "title-pathfinder",
      category: "title",
      description: "Вы находите новые пути",
      price: 2,
      rarity: "rare",
      cssData: { text: "Следопыт", color: "#3b82f6" },
      imageUrl: null,
    },
    {
      name: "Исследователь Ростова",
      slug: "title-explorer",
      category: "title",
      description: "Вы знаете город лучше большинства",
      price: 3,
      rarity: "rare",
      cssData: { text: "Исследователь Ростова", color: "#0ea5e9" },
      imageUrl: null,
    },
    {
      name: "Покоритель маршрутов",
      slug: "title-conqueror",
      category: "title",
      description: "Ни один маршрут вам не страшен",
      price: 5,
      rarity: "epic",
      cssData: { text: "Покоритель маршрутов", color: "#a855f7" },
      imageUrl: null,
    },
    {
      name: "Легенда Ростова",
      slug: "title-legend",
      category: "title",
      description: "Вас знает весь город",
      price: 8,
      rarity: "epic",
      cssData: { text: "Легенда Ростова", color: "#f97316" },
      imageUrl: null,
    },
    {
      name: "Властелин прогулок",
      slug: "title-lord",
      category: "title",
      description: "Улицы покоряются перед вами",
      price: 15,
      rarity: "legendary",
      cssData: { text: "Властелин прогулок", color: "#eab308" },
      imageUrl: null,
    },
    {
      name: "Бессмертный",
      slug: "title-immortal",
      category: "title",
      description: "Ваше имя навсегда в истории города",
      price: 20,
      rarity: "legendary",
      cssData: { text: "Бессмертный", color: "#ef4444" },
      imageUrl: null,
    },

    // ═══ ЦВЕТ НИКА ═══
    {
      name: "Красный ник",
      slug: "color-red",
      category: "usernameColor",
      description: "Ваш ник будет красным",
      price: 2,
      rarity: "common",
      cssData: { color: "#ef4444" },
      imageUrl: null,
    },
    {
      name: "Синий ник",
      slug: "color-blue",
      category: "usernameColor",
      description: "Ваш ник будет синим",
      price: 2,
      rarity: "common",
      cssData: { color: "#3b82f6" },
      imageUrl: null,
    },
    {
      name: "Зелёный ник",
      slug: "color-green",
      category: "usernameColor",
      description: "Ваш ник будет зелёным",
      price: 2,
      rarity: "common",
      cssData: { color: "#22c55e" },
      imageUrl: null,
    },
    {
      name: "Оранжевый ник",
      slug: "color-orange",
      category: "usernameColor",
      description: "Яркий оранжевый цвет ника",
      price: 2,
      rarity: "common",
      cssData: { color: "#f97316" },
      imageUrl: null,
    },
    {
      name: "Фиолетовый ник",
      slug: "color-purple",
      category: "usernameColor",
      description: "Ваш ник выделяется фиолетовым",
      price: 3,
      rarity: "rare",
      cssData: { color: "#a855f7" },
      imageUrl: null,
    },
    {
      name: "Розовый ник",
      slug: "color-pink",
      category: "usernameColor",
      description: "Нежный розовый оттенок",
      price: 3,
      rarity: "rare",
      cssData: { color: "#ec4899" },
      imageUrl: null,
    },
    {
      name: "Бирюзовый ник",
      slug: "color-teal",
      category: "usernameColor",
      description: "Свежий бирюзовый цвет",
      price: 3,
      rarity: "rare",
      cssData: { color: "#14b8a6" },
      imageUrl: null,
    },
    {
      name: "Золотой ник",
      slug: "color-gold",
      category: "usernameColor",
      description: "Золотой цвет для настоящих ценителей",
      price: 5,
      rarity: "epic",
      cssData: { color: "#eab308" },
      imageUrl: null,
    },
    {
      name: "Рубиновый ник",
      slug: "color-ruby",
      category: "usernameColor",
      description: "Глубокий красный, как драгоценный камень",
      price: 8,
      rarity: "epic",
      cssData: { color: "#dc2626" },
      imageUrl: null,
    },
    {
      name: "Алмазный ник",
      slug: "color-diamond",
      category: "usernameColor",
      description: "Сверкающий голубой цвет бриллианта",
      price: 12,
      rarity: "legendary",
      cssData: { color: "#7dd3fc" },
      imageUrl: null,
    },

    // ═══ ТЕМЫ ЧАТА ═══
    {
      name: "Звёздная ночь",
      slug: "chat-starry",
      category: "chatTheme",
      description: "Тёмная тема с эффектом звёздного неба",
      price: 5,
      rarity: "rare",
      cssData: {
        id: "starry",
        name: "Звёздная ночь",
        bubble: "#6366f1",
        bubbleText: "#ffffff",
        accent: "#818cf8",
        bg: "radial-gradient(circle at 15% 15%, rgba(147,130,255,0.25) 0%, transparent 40%), radial-gradient(circle at 85% 25%, rgba(99,102,241,0.2) 0%, transparent 35%), radial-gradient(circle at 50% 80%, rgba(79,70,229,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 60%, #fff 0.3px, transparent 0.3px), radial-gradient(circle at 80% 40%, #fff 0.2px, transparent 0.2px), radial-gradient(circle at 45% 20%, #fff 0.3px, transparent 0.3px), radial-gradient(circle at 70% 75%, #fff 0.2px, transparent 0.2px), linear-gradient(180deg, #070b34 0%, #0d1357 40%, #1a1145 100%)",
        dark: true,
      },
      imageUrl: null,
    },
    {
      name: "Закат над Доном",
      slug: "chat-sunset",
      category: "chatTheme",
      description: "Тёплые тона заката над Доном",
      price: 5,
      rarity: "rare",
      cssData: {
        id: "sunset",
        name: "Закат над Доном",
        bubble: "#f97316",
        bubbleText: "#ffffff",
        accent: "#fb923c",
        bg: "linear-gradient(180deg, #0c0a1a 0%, #1b1040 15%, #2d1b5e 30%, #6b2fa0 45%, #c2185b 60%, #e65100 75%, #ff8f00 90%, #ffd54f 100%)",
        dark: true,
      },
      imageUrl: null,
    },
    {
      name: "Киберпанк",
      slug: "chat-cyberpunk",
      category: "chatTheme",
      description: "Неоновые огни ночного города",
      price: 8,
      rarity: "epic",
      cssData: {
        id: "cyberpunk",
        name: "Киберпанк",
        bubble: "#f43f5e",
        bubbleText: "#ffffff",
        accent: "#fb7185",
        bg: "repeating-linear-gradient(0deg, transparent 0px, transparent 30px, rgba(255,0,100,0.03) 30px, rgba(255,0,100,0.03) 31px), repeating-linear-gradient(90deg, transparent 0px, transparent 30px, rgba(0,255,255,0.03) 30px, rgba(0,255,255,0.03) 31px), radial-gradient(ellipse at 20% 80%, rgba(255,0,100,0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(0,200,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(130,0,255,0.1) 0%, transparent 60%), linear-gradient(180deg, #0a0014 0%, #110022 40%, #0a0a1a 100%)",
        dark: true,
      },
      imageUrl: null,
    },
    {
      name: "Весенний сад",
      slug: "chat-spring",
      category: "chatTheme",
      description: "Нежные цвета весеннего цветения",
      price: 5,
      rarity: "rare",
      cssData: {
        id: "spring",
        name: "Весенний сад",
        bubble: "#10b981",
        bubbleText: "#ffffff",
        accent: "#34d399",
        bg: "radial-gradient(circle at 20% 30%, rgba(236,72,153,0.1) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(52,211,153,0.1) 0%, transparent 40%), radial-gradient(circle at 50% 90%, rgba(167,243,208,0.08) 0%, transparent 40%), linear-gradient(160deg, rgba(254,243,199,0.15) 0%, rgba(236,253,245,0.1) 40%, rgba(254,215,226,0.08) 70%, rgba(243,232,255,0.1) 100%)",
      },
      imageUrl: null,
    },
    {
      name: "Аврора",
      slug: "chat-aurora",
      category: "chatTheme",
      description: "Северное сияние в вашем чате",
      price: 12,
      rarity: "legendary",
      cssData: {
        id: "aurora",
        name: "Аврора",
        bubble: "#06b6d4",
        bubbleText: "#ffffff",
        accent: "#22d3ee",
        bg: "radial-gradient(ellipse at 30% 0%, rgba(34,211,238,0.25) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(16,185,129,0.2) 0%, transparent 45%), radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.15) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(6,182,212,0.1) 0%, transparent 40%), linear-gradient(180deg, #021a1a 0%, #042f2e 20%, #0f3b4a 40%, #1a2755 60%, #251450 80%, #1a0a30 100%)",
        dark: true,
      },
      imageUrl: null,
    },

    // ═══ БАННЕРЫ ═══
    {
      name: "Ростов набережная",
      slug: "banner-embankment",
      category: "banner",
      description: "Вид на набережную Дона для вашего профиля",
      price: 3,
      rarity: "rare",
      cssData: { gradient: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)" },
      imageUrl: null,
    },
    {
      name: "Ночной город",
      slug: "banner-night",
      category: "banner",
      description: "Огни ночного Ростова",
      price: 5,
      rarity: "epic",
      cssData: { gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)" },
      imageUrl: null,
    },
    {
      name: "Золотой рассвет",
      slug: "banner-sunrise",
      category: "banner",
      description: "Рассвет над Доном в золотых тонах",
      price: 10,
      rarity: "legendary",
      cssData: { gradient: "linear-gradient(135deg, #92400e 0%, #d97706 30%, #fbbf24 60%, #fef3c7 100%)" },
      imageUrl: null,
    },
  ];

  let shopSeeded = 0;
  let shopUpdated = 0;
  for (const item of shopItems) {
    const exists = await db.collection("shop_items").findOne({ slug: item.slug });
    if (!exists) {
      await db.collection("shop_items").insertOne({
        ...item,
        isActive: true,
        createdAt: now,
      });
      shopSeeded++;
    } else {
      // Обновляем cssData, name, description, rarity, price если изменились
      await db.collection("shop_items").updateOne(
        { slug: item.slug },
        { $set: { cssData: item.cssData, name: item.name, description: item.description, rarity: item.rarity, price: item.price } }
      );
      shopUpdated++;
    }
  }
  log.push(`Seed магазина: добавлено ${shopSeeded}, обновлено ${shopUpdated} (из ${shopItems.length})`);

  // 18. Обновить equippedItems у пользователей (синхронизация cssData из shop_items)
  const usersWithEquipped = await db.collection("users").find({ equippedItems: { $exists: true, $ne: {} } }).toArray();
  let equippedUpdated = 0;
  for (const u of usersWithEquipped) {
    const eq = u.equippedItems || {};
    const updates = {};
    for (const [cat, data] of Object.entries(eq)) {
      if (!data?.slug) continue;
      const item = await db.collection("shop_items").findOne({ slug: data.slug });
      if (item) {
        updates[`equippedItems.${cat}`] = {
          slug: item.slug,
          name: item.name,
          cssData: item.cssData || {},
          imageUrl: item.imageUrl || null,
        };
      }
    }
    if (Object.keys(updates).length > 0) {
      await db.collection("users").updateOne({ _id: u._id }, { $set: updates });
      equippedUpdated++;
    }
  }
  if (equippedUpdated > 0) log.push(`Обновлены equippedItems у ${equippedUpdated} пользователей`);

  return NextResponse.json({ success: true, log });
}
