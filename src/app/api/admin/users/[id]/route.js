import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions, isSuperadmin, getTopPosition, getAllRoles } from "@/lib/permissions";
import { logCoinTransaction } from "@/lib/coinTransactions";
import { createNotification } from "@/lib/notifications";
import { pushNotification } from "@/lib/sse";

// PUT /api/admin/users/[id] — обновить пользователя (split permissions)
export async function PUT(request, { params }) {
  const authResult = await requireAuth(request);
  if (authResult.error) return authResult.error;

  const { user: caller } = authResult;
  const callerPerms = await resolveUserPermissions(caller);
  const callerId = caller._id.toString();

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const body = await request.json();
  const db = await getDb();
  const update = {};

  // Загружаем целевого юзера
  const target = await db.collection("users").findOne({ _id: new ObjectId(id) });
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  // Роли (массив ObjectId)
  if (body.roles !== undefined) {
    if (!callerPerms.includes("users.assign_roles")) {
      return NextResponse.json({ error: "Нет прав для назначения ролей" }, { status: 403 });
    }

    // Нельзя менять свои роли (кроме суперадмина)
    if (id === callerId && !isSuperadmin(caller)) {
      return NextResponse.json({ error: "Нельзя изменить свои роли" }, { status: 400 });
    }

    // Нельзя менять роли суперадмину
    if (isSuperadmin(target) && !isSuperadmin(caller)) {
      return NextResponse.json({ error: "Нельзя изменить роли суперадмина" }, { status: 403 });
    }

    // Валидация: все roleIds существуют и их position < callerMaxPosition
    const allRoles = await getAllRoles();
    const callerTopPos = await getTopPosition(caller);
    const roleIds = [];

    for (const rid of body.roles) {
      const role = allRoles.find((r) => r._id.toString() === rid);
      if (!role) {
        return NextResponse.json({ error: `Роль ${rid} не найдена` }, { status: 400 });
      }
      if (role.position <= callerTopPos && !isSuperadmin(caller)) {
        return NextResponse.json({ error: `Нельзя назначить роль "${role.name}" — позиция слишком высокая` }, { status: 403 });
      }
      roleIds.push(new ObjectId(rid));
    }

    update.roles = roleIds;

    // Backward-compat: обновляем старое поле role
    if (roleIds.length === 0) {
      update.role = "user";
    } else {
      const topRole = allRoles
        .filter((r) => roleIds.some((rid) => rid.toString() === r._id.toString()))
        .sort((a, b) => a.position - b.position)[0];
      update.role = topRole?.slug || "user";
    }
  }

  // Бан
  if (body.banned !== undefined) {
    if (!callerPerms.includes("users.ban")) {
      return NextResponse.json({ error: "Нет прав для бана" }, { status: 403 });
    }
    if (id === callerId) {
      return NextResponse.json({ error: "Нельзя забанить себя" }, { status: 400 });
    }
    // Нельзя забанить суперадмина
    if (isSuperadmin(target)) {
      return NextResponse.json({ error: "Нельзя забанить суперадмина" }, { status: 403 });
    }
    update.banned = !!body.banned;

    if (update.banned) {
      // Причина бана
      const banReason = typeof body.banReason === "string" ? body.banReason.trim().slice(0, 500) : "";
      update.banReason = banReason || null;
      update.bannedAt = new Date();
      update.bannedBy = callerId;

      // Длительность: 0 или undefined = перманентный, число дней = временный
      const banDuration = Number(body.banDuration);
      if (banDuration > 0) {
        update.banExpiresAt = new Date(Date.now() + banDuration * 24 * 60 * 60 * 1000);
      } else {
        update.banExpiresAt = null;
      }

      await db.collection("refresh_tokens").deleteMany({ userId: id });

      // Запись в историю банов
      await db.collection("ban_history").insertOne({
        userId: id,
        action: "ban",
        reason: update.banReason,
        duration: banDuration > 0 ? banDuration : null,
        bannedBy: callerId,
        bannedByUsername: caller.username,
        createdAt: new Date(),
      });

      // Уведомление пользователю
      const banData = {
        reason: update.banReason,
        duration: banDuration > 0 ? banDuration : null,
        adminUsername: caller.username,
      };
      await createNotification(id, "account_banned", banData);
      pushNotification(id, { type: "account_banned", ...banData });
    } else {
      // Разбан
      update.banReason = null;
      update.bannedAt = null;
      update.bannedBy = null;
      update.banExpiresAt = null;

      // Запись в историю банов
      await db.collection("ban_history").insertOne({
        userId: id,
        action: "unban",
        reason: typeof body.unbanReason === "string" ? body.unbanReason.trim().slice(0, 500) : null,
        duration: null,
        bannedBy: callerId,
        bannedByUsername: caller.username,
        createdAt: new Date(),
      });
    }
  }

  // Монеты
  if (body.addCoins !== undefined) {
    if (!callerPerms.includes("users.manage_coins")) {
      return NextResponse.json({ error: "Нет прав для управления монетами" }, { status: 403 });
    }
    const delta = Number(body.addCoins);
    if (isNaN(delta)) {
      return NextResponse.json({ error: "Невалидное число монет" }, { status: 400 });
    }
    update.coins = Math.max(0, (target.coins || 0) + delta);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const result = await db
    .collection("users")
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after", projection: { passwordHash: 0 } }
    );

  // Логируем транзакцию монет
  if (body.addCoins !== undefined) {
    const delta = Number(body.addCoins);
    if (!isNaN(delta) && delta !== 0) {
      const coinMsg = typeof body.coinMessage === "string" ? body.coinMessage.trim().slice(0, 200) : "";
      await logCoinTransaction(db, {
        userId: id,
        type: delta > 0 ? "admin_add" : "admin_subtract",
        amount: delta,
        balance: result?.coins || 0,
        meta: { adminId: callerId, adminUsername: caller.username, ...(coinMsg && { message: coinMsg }) },
      });
      // Уведомление пользователю о начислении/списании
      const coinData = {
        amount: delta,
        adminUsername: caller.username,
        ...(coinMsg && { message: coinMsg }),
      };
      await createNotification(id, "coin_admin", coinData);
      pushNotification(id, { type: "coin_admin", ...coinData });
    }
  }

  if (!result) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    ...result,
    _id: result._id.toString(),
  });
}
