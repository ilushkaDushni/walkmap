import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

// ─── Permission Registry ────────────────────────────────────────
export const PERMISSION_REGISTRY = {
  "admin.access":       { label: "Доступ к админ-панели",       group: "Админ" },
  "routes.create":      { label: "Создание маршрутов",          group: "Маршруты" },
  "routes.edit":        { label: "Редактирование маршрутов",    group: "Маршруты" },
  "routes.delete":      { label: "Удаление маршрутов",          group: "Маршруты" },
  "routes.view_hidden": { label: "Просмотр скрытых маршрутов",  group: "Маршруты" },
  "routes.set_featured": { label: "Маршрут дня/недели",         group: "Маршруты" },
  "folders.create":     { label: "Создание папок",              group: "Папки" },
  "folders.edit":       { label: "Редактирование папок",        group: "Папки" },
  "folders.delete":     { label: "Удаление папок",              group: "Папки" },
  "folders.visibility": { label: "Управление видимостью",       group: "Папки" },
  "users.view":         { label: "Просмотр пользователей",      group: "Пользователи" },
  "users.ban":          { label: "Бан/разбан",                  group: "Пользователи" },
  "users.manage_coins": { label: "Управление монетами",         group: "Пользователи" },
  "users.assign_roles": { label: "Назначение ролей",            group: "Пользователи" },
  "roles.manage":       { label: "Управление ролями",           group: "Роли" },
  "roles.preview":      { label: "Просмотр от имени роли",      group: "Роли" },
  "upload.files":       { label: "Загрузка файлов",             group: "Файлы" },
  "comments.manage":    { label: "Управление комментариями",    group: "Комментарии" },
  "notifications.broadcast": { label: "Рассылка уведомлений",  group: "Уведомления" },
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_REGISTRY);

// ─── Roles Cache (in-memory, TTL 60s) ───────────────────────────
let rolesCache = null;
let rolesCacheTime = 0;
const ROLES_CACHE_TTL = 60_000;

export function invalidateRolesCache() {
  rolesCache = null;
  rolesCacheTime = 0;
}

export async function getAllRoles() {
  const now = Date.now();
  if (rolesCache && now - rolesCacheTime < ROLES_CACHE_TTL) {
    return rolesCache;
  }
  const db = await getDb();
  const roles = await db.collection("roles").find({}).sort({ position: 1 }).toArray();
  rolesCache = roles;
  rolesCacheTime = now;
  return roles;
}

// ─── Superadmin ─────────────────────────────────────────────────
export function isSuperadmin(user) {
  if (!process.env.SUPERADMIN_EMAIL) return false;
  return user.email === process.env.SUPERADMIN_EMAIL;
}

// ─── Resolve Permissions ────────────────────────────────────────

/**
 * Backward-compat: если user.roles пуст, но user.role есть — используем старую систему
 */
async function getLegacyPermissions(user) {
  if (user.role === "admin") return [...ALL_PERMISSIONS];
  if (user.role === "moderator") {
    return ["admin.access", "routes.create", "routes.edit", "routes.delete",
      "routes.view_hidden", "folders.create", "folders.edit", "folders.delete",
      "folders.visibility", "users.view", "upload.files"];
  }
  return [];
}

/**
 * Union прав всех ролей юзера. Суперадмин → все права.
 */
export async function resolveUserPermissions(user) {
  if (isSuperadmin(user)) return [...ALL_PERMISSIONS];

  const userRoleIds = user.roles;
  if (!userRoleIds || userRoleIds.length === 0) {
    return getLegacyPermissions(user);
  }

  const allRoles = await getAllRoles();
  const permsSet = new Set();

  for (const roleId of userRoleIds) {
    const roleIdStr = roleId.toString();
    const role = allRoles.find((r) => r._id.toString() === roleIdStr);
    if (role?.permissions) {
      for (const p of role.permissions) permsSet.add(p);
    }
  }

  return [...permsSet];
}

/**
 * Полные объекты ролей для фронтенда
 */
export async function resolveUserRolesData(user) {
  const userRoleIds = user.roles;
  if (!userRoleIds || userRoleIds.length === 0) {
    // Legacy fallback: возвращаем роль как объект
    if (user.role && user.role !== "user") {
      return [{
        id: null,
        name: user.role === "admin" ? "Админ" : "Модератор",
        slug: user.role,
        color: user.role === "admin" ? "#3b82f6" : "#ef4444",
        position: user.role === "admin" ? 1 : 2,
      }];
    }
    return [];
  }

  const allRoles = await getAllRoles();
  const result = [];

  for (const roleId of userRoleIds) {
    const roleIdStr = roleId.toString();
    const role = allRoles.find((r) => r._id.toString() === roleIdStr);
    if (role) {
      result.push({
        id: role._id.toString(),
        name: role.name,
        slug: role.slug,
        color: role.color,
        position: role.position,
      });
    }
  }

  // Сортируем по position asc (1 = главная роль первая)
  result.sort((a, b) => a.position - b.position);
  return result;
}

/**
 * Convert legacy S3 direct URLs to proxy URLs.
 */
function toProxyUrl(url) {
  if (!url) return null;
  if (url.startsWith("/api/media/")) return url;
  const s3Host = "https://storage.yandexcloud.net/";
  if (url.startsWith(s3Host)) {
    const rest = url.slice(s3Host.length);
    const idx = rest.indexOf("/");
    if (idx !== -1) return `/api/media/${rest.slice(idx + 1)}`;
  }
  return url;
}

/**
 * Собирает полный объект юзера для фронтенда
 */
export async function buildUserResponse(user) {
  const [permissions, roles] = await Promise.all([
    resolveUserPermissions(user),
    resolveUserRolesData(user),
  ]);

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    avatarUrl: toProxyUrl(user.avatarUrl),
    coins: user.coins || 0,
    bio: user.bio || "",
    roles,
    permissions,
    isSuperadmin: isSuperadmin(user),
    banned: !!user.banned,
  };
}

/**
 * Лучшая (минимальная) позиция среди ролей юзера (1 = самая главная)
 */
export async function getTopPosition(user) {
  if (isSuperadmin(user)) return 0; // суперадмин выше всех

  const rolesData = await resolveUserRolesData(user);
  if (rolesData.length === 0) return Infinity;
  return Math.min(...rolesData.map((r) => r.position));
}
