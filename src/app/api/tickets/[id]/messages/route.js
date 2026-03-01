import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/tickets/[id]/messages — добавить сообщение к тикету
export async function POST(request, { params }) {
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

  if (ticket.status === "closed") {
    return NextResponse.json({ error: "Тикет закрыт" }, { status: 400 });
  }

  const body = await request.json();
  const text = (body.text || "").trim().slice(0, 1000);
  const imageUrl = (body.imageUrl || "").trim() || null;

  if (!text && !imageUrl) {
    return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
  }

  const now = new Date();

  const msg = {
    ticketId: id,
    senderId: user._id.toString(),
    senderType: "user",
    text,
    createdAt: now,
  };
  if (imageUrl) msg.imageUrl = imageUrl;

  await db.collection("ticket_messages").insertOne(msg);

  await db.collection("tickets").updateOne(
    { _id: new ObjectId(id) },
    { $set: { updatedAt: now } }
  );

  return NextResponse.json({ ok: true });
}
