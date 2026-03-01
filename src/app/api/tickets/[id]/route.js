import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/tickets/[id] — тикет + все сообщения
export async function GET(request, { params }) {
  const { user, error } = await requireAuth(request);
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

  if (ticket.userId !== user._id.toString()) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const messages = await db
    .collection("ticket_messages")
    .find({ ticketId: id })
    .sort({ createdAt: 1 })
    .toArray();

  // Lookup admin senders for admin messages
  const adminSenderIds = [...new Set(messages.filter((m) => m.senderType === "admin").map((m) => m.senderId))];
  const senderMap = {};
  if (adminSenderIds.length > 0) {
    const senders = await db
      .collection("users")
      .find(
        { _id: { $in: adminSenderIds.map((sid) => new ObjectId(sid)) } },
        { projection: { username: 1, avatarUrl: 1 } }
      )
      .toArray();
    for (const s of senders) {
      senderMap[s._id.toString()] = { username: s.username, avatarUrl: s.avatarUrl || null };
    }
  }

  return NextResponse.json({
    id: ticket._id.toString(),
    ticketNumber: ticket.ticketNumber || null,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt,
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId,
      senderType: m.senderType,
      text: m.text,
      imageUrl: m.imageUrl || null,
      sender: m.senderType === "admin" ? (senderMap[m.senderId] || { username: "Поддержка", avatarUrl: null }) : null,
      createdAt: m.createdAt,
    })),
  });
}
