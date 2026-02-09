import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { verifyAccessToken } from "./tokens";
import { getDb } from "./mongodb";
import { resolveUserPermissions, isSuperadmin } from "./permissions";

/**
 * Верифицирует JWT, загружает юзера из DB, проверяет бан.
 * @returns {{ user, payload } | { error: NextResponse }}
 */
export async function requireAuth(request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  }

  const payload = await verifyAccessToken(auth.slice(7));
  if (!payload) {
    return { error: NextResponse.json({ error: "Невалидный токен" }, { status: 401 }) };
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(payload.userId) });

  if (!user) {
    return { error: NextResponse.json({ error: "Пользователь не найден" }, { status: 401 }) };
  }

  if (user.banned && !isSuperadmin(user)) {
    return { error: NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 }) };
  }

  return { user, payload };
}

/**
 * requireAuth + проверка что юзер имеет ВСЕ перечисленные права (AND)
 */
export async function requirePermission(request, ...perms) {
  const result = await requireAuth(request);
  if (result.error) return result;

  const { user } = result;
  const userPerms = await resolveUserPermissions(user);

  for (const p of perms) {
    if (!userPerms.includes(p)) {
      return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) };
    }
  }

  return { user, payload: result.payload, permissions: userPerms };
}

/**
 * requireAuth + проверка что юзер имеет ХОТЯ БЫ ОДНО из прав (OR)
 */
export async function requireAnyPermission(request, ...perms) {
  const result = await requireAuth(request);
  if (result.error) return result;

  const { user } = result;
  const userPerms = await resolveUserPermissions(user);

  const hasAny = perms.some((p) => userPerms.includes(p));
  if (!hasAny) {
    return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) };
  }

  return { user, payload: result.payload, permissions: userPerms };
}

/**
 * Backward-compat wrapper: проверяет admin.access
 */
export async function requireAdmin(request) {
  return requirePermission(request, "admin.access");
}
