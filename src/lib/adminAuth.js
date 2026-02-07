import { NextResponse } from "next/server";
import { verifyAccessToken } from "./tokens";

/**
 * Проверяет что запрос от авторизованного админа.
 * @returns {{ payload } | { error: NextResponse }}
 */
export async function requireAdmin(request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  }

  const payload = await verifyAccessToken(auth.slice(7));
  if (!payload) {
    return { error: NextResponse.json({ error: "Невалидный токен" }, { status: 401 }) };
  }

  if (payload.role !== "admin") {
    return { error: NextResponse.json({ error: "Нет прав администратора" }, { status: 403 }) };
  }

  return { payload };
}
