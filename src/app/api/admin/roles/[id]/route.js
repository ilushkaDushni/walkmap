import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { ALL_PERMISSIONS, invalidateRolesCache, getMaxPosition, isSuperadmin } from "@/lib/permissions";

// GET /api/admin/roles/[id]
export async function GET(request, { params }) {
  const { error } = await requirePermission(request, "admin.access");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const role = await db.collection("roles").findOne({ _id: new ObjectId(id) });

  if (!role) {
    return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
  }

  return NextResponse.json({ ...role, _id: role._id.toString() });
}

// PUT /api/admin/roles/[id] — обновить роль
export async function PUT(request, { params }) {
  const { user, error } = await requirePermission(request, "roles.manage");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const role = await db.collection("roles").findOne({ _id: new ObjectId(id) });

  if (!role) {
    return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
  }

  const body = await request.json();
  const update = { updatedAt: new Date() };

  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
    }
    // Проверка уникальности
    const dup = await db.collection("roles").findOne({
      name: body.name.trim(),
      _id: { $ne: new ObjectId(id) },
    });
    if (dup) {
      return NextResponse.json({ error: "Роль с таким именем уже существует" }, { status: 409 });
    }
    update.name = body.name.trim();
  }

  if (body.slug !== undefined && !role.isSystem) {
    const slugVal = body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const dup = await db.collection("roles").findOne({
      slug: slugVal,
      _id: { $ne: new ObjectId(id) },
    });
    if (dup) {
      return NextResponse.json({ error: "Роль с таким slug уже существует" }, { status: 409 });
    }
    update.slug = slugVal;
  }

  if (body.color !== undefined) update.color = body.color;

  if (body.position !== undefined) {
    const pos = Number(body.position);
    const callerMaxPos = await getMaxPosition(user);
    if (pos >= callerMaxPos && !isSuperadmin(user)) {
      return NextResponse.json({ error: "Позиция слишком высокая" }, { status: 403 });
    }
    update.position = pos;
  }

  if (body.permissions !== undefined) {
    update.permissions = (body.permissions || []).filter((p) => ALL_PERMISSIONS.includes(p));
  }

  if (body.isDefault !== undefined) {
    update.isDefault = !!body.isDefault;
  }

  const result = await db
    .collection("roles")
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );

  invalidateRolesCache();

  return NextResponse.json({ ...result, _id: result._id.toString() });
}

// DELETE /api/admin/roles/[id] — удалить роль
export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, "roles.manage");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const role = await db.collection("roles").findOne({ _id: new ObjectId(id) });

  if (!role) {
    return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
  }

  if (role.isSystem) {
    return NextResponse.json({ error: "Нельзя удалить системную роль" }, { status: 400 });
  }

  // Удаляем роль из всех юзеров
  await db.collection("users").updateMany(
    { roles: new ObjectId(id) },
    { $pull: { roles: new ObjectId(id) } }
  );

  await db.collection("roles").deleteOne({ _id: new ObjectId(id) });
  invalidateRolesCache();

  return NextResponse.json({ success: true });
}
