import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// DELETE /api/admin/lobbies/[id] — принудительное закрытие лобби
export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, "admin.access");
  if (error) return error;

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();

  const result = await db.collection("lobbies").findOneAndUpdate(
    { _id: new ObjectId(id), status: "active" },
    { $set: { status: "closed", closedAt: new Date() } },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Лобби не найдено или уже закрыто" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
