import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// PUT /api/folders/[id] — обновить папку
export async function PUT(request, { params }) {
  const { error } = await requirePermission(request, "folders.edit");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const body = await request.json();
  const update = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.sortOrder !== undefined) update.sortOrder = Number(body.sortOrder);
  if (body.adminOnly !== undefined) update.adminOnly = !!body.adminOnly;
  if (body.exceptions !== undefined) update.exceptions = body.exceptions;

  const db = await getDb();
  const result = await db
    .collection("folders")
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: "after" }
    );

  if (!result) {
    return NextResponse.json({ error: "Папка не найдена" }, { status: 404 });
  }

  return NextResponse.json(result);
}

// DELETE /api/folders/[id] — удалить папку
export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, "folders.delete");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const oid = new ObjectId(id);

  // Убрать эту папку из folderIds маршрутов
  await db
    .collection("routes")
    .updateMany({ folderIds: id }, { $pull: { folderIds: id } });

  const result = await db.collection("folders").deleteOne({ _id: oid });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Папка не найдена" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
