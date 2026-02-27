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

  return NextResponse.json({
    id: ticket._id.toString(),
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
      createdAt: m.createdAt,
    })),
  });
}
