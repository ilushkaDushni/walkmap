import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { totalPathDistance } from "@/lib/geo";

// GET /api/routes/[id]
export async function GET(request, { params }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const route = await db.collection("routes").findOne({ _id: new ObjectId(id) });

  if (!route) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  return NextResponse.json(route);
}

// PUT /api/routes/[id] — обновить
export async function PUT(request, { params }) {
  const { error } = await requirePermission(request, "routes.edit");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const body = await request.json();
  const db = await getDb();

  // Авто-расчёт distance и duration
  if (body.path && body.path.length >= 2) {
    body.distance = Math.round(totalPathDistance(body.path));
    // ~4 km/h пешком = ~67 м/мин
    body.duration = Math.max(1, Math.round(body.distance / 67));
  }

  body.updatedAt = new Date();

  // Не даём менять служебные поля
  delete body._id;
  delete body.createdBy;
  delete body.createdAt;

  const result = await db
    .collection("routes")
    .findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: body },
      { returnDocument: "after" }
    );

  if (!result) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  return NextResponse.json(result);
}

// DELETE /api/routes/[id] — удалить
export async function DELETE(request, { params }) {
  const { error } = await requirePermission(request, "routes.delete");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection("routes").deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
