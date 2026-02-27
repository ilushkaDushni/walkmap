import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/tickets/[id] — тикет + все сообщения
export async function GET(request, { params }) {
  const { error } = await requirePermission(request, "feedback.manage");
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

  // Lookup user
  const ticketUser = await db
    .collection("users")
    .findOne(
      { _id: new ObjectId(ticket.userId) },
      { projection: { username: 1, avatarUrl: 1, email: 1 } }
    );

  const messages = await db
    .collection("ticket_messages")
    .find({ ticketId: id })
    .sort({ createdAt: 1 })
    .toArray();

  // Lookup senders
  const senderIds = [...new Set(messages.map((m) => m.senderId))];
  const senders = await db
    .collection("users")
    .find(
      { _id: { $in: senderIds.map((sid) => new ObjectId(sid)) } },
      { projection: { username: 1, avatarUrl: 1 } }
    )
    .toArray();

  const senderMap = {};
  for (const s of senders) {
    senderMap[s._id.toString()] = { username: s.username, avatarUrl: s.avatarUrl || null };
  }

  return NextResponse.json({
    id: ticket._id.toString(),
    subject: ticket.subject,
    status: ticket.status,
    userId: ticket.userId,
    user: ticketUser
      ? { username: ticketUser.username, avatarUrl: ticketUser.avatarUrl || null, email: ticketUser.email }
      : { username: "Удалён", avatarUrl: null, email: null },
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt,
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId,
      senderType: m.senderType,
      sender: senderMap[m.senderId] || { username: "Удалён", avatarUrl: null },
      text: m.text,
      createdAt: m.createdAt,
    })),
  });
}

// PATCH /api/admin/tickets/[id] — сменить статус
export async function PATCH(request, { params }) {
  const { error } = await requirePermission(request, "feedback.manage");
  if (error) return error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  const db = await getDb();
  const body = await request.json();
  const { status } = body;

  if (status !== "open" && status !== "closed") {
    return NextResponse.json({ error: "Неверный статус" }, { status: 400 });
  }

  const now = new Date();
  const update = { $set: { status, updatedAt: now } };
  if (status === "closed") update.$set.closedAt = now;
  if (status === "open") update.$set.closedAt = null;

  const result = await db.collection("tickets").updateOne(
    { _id: new ObjectId(id) },
    update
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Тикет не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, status });
}
