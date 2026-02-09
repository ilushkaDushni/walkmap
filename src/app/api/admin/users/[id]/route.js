import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions, isSuperadmin, getMaxPosition, getAllRoles } from "@/lib/permissions";

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
    const callerMaxPos = await getMaxPosition(caller);
    const roleIds = [];

    for (const rid of body.roles) {
      const role = allRoles.find((r) => r._id.toString() === rid);
      if (!role) {
        return NextResponse.json({ error: `Роль ${rid} не найдена` }, { status: 400 });
      }
      if (role.position >= callerMaxPos && !isSuperadmin(caller)) {
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
        .sort((a, b) => b.position - a.position)[0];
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
      await db.collection("refresh_tokens").deleteMany({ userId: id });
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

  if (!result) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  return NextResponse.json({
    ...result,
    _id: result._id.toString(),
  });
}
