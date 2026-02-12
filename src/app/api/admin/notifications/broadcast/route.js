import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// POST /api/admin/notifications/broadcast — рассылка уведомлений
export async function POST(request) {
  const { error } = await requirePermission(request, "notifications.broadcast");
  if (error) return error;

  const { message, roleIds } = await request.json();

  if (!message?.trim() || message.trim().length > 500) {
    return NextResponse.json({ error: "Сообщение обязательно (до 500 символов)" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  // Находим целевых юзеров
  let filter = {};
  if (roleIds && roleIds.length > 0) {
    const objectIds = roleIds.map((id) => new ObjectId(id));
    filter.roles = { $in: objectIds };
  }

  const users = await db
    .collection("users")
    .find(filter, { projection: { _id: 1 } })
    .toArray();

  if (users.length === 0) {
    return NextResponse.json({ error: "Нет подходящих получателей" }, { status: 400 });
  }

  const docs = users.map((u) => ({
    userId: u._id.toString(),
    type: "admin_broadcast",
    data: { message: message.trim() },
    read: false,
    createdAt: now,
  }));

  await db.collection("notifications").insertMany(docs);

  return NextResponse.json({ ok: true, sent: users.length });
}
