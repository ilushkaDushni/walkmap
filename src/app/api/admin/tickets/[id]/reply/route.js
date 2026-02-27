import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";
import { createNotification } from "@/lib/notifications";

// POST /api/admin/tickets/[id]/reply — ответ админа
export async function POST(request, { params }) {
  const { user, error } = await requirePermission(request, "feedback.manage");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const db = await getDb();
  const ticket = await db.collection("tickets").findOne({ _id: new ObjectId(id) });

  if (!ticket) {
    return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
  }

  const body = await request.json();
  const text = (body.text || "").trim().slice(0, 1000);

  if (!text) {
    return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
  }

  const now = new Date();

  await db.collection("ticket_messages").insertOne({
    ticketId: id,
    senderId: user._id.toString(),
    senderType: "admin",
    text,
    createdAt: now,
  });

  await db.collection("tickets").updateOne(
    { _id: new ObjectId(id) },
    { $set: { updatedAt: now } }
  );

  // Уведомление пользователю
  await createNotification(ticket.userId, "ticket_reply", {
    ticketId: id,
    subject: ticket.subject,
    adminUsername: user.username,
  });

  return NextResponse.json({ ok: true });
}
