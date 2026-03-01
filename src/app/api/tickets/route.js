import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/tickets — список тикетов текущего пользователя
export async function GET(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const db = await getDb();
  const userId = user._id.toString();

  const tickets = await db
    .collection("tickets")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();

  // Подсчёт сообщений для каждого тикета
  const ticketIds = tickets.map((t) => t._id.toString());
  const msgCounts = await db
    .collection("ticket_messages")
    .aggregate([
      { $match: { ticketId: { $in: ticketIds } } },
      { $group: { _id: "$ticketId", count: { $sum: 1 } } },
    ])
    .toArray();

  const countMap = {};
  for (const m of msgCounts) countMap[m._id] = m.count;

  const result = tickets.map((t) => ({
    id: t._id.toString(),
    ticketNumber: t.ticketNumber || null,
    subject: t.subject,
    status: t.status,
    messageCount: countMap[t._id.toString()] || 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return NextResponse.json(result);
}

// POST /api/tickets — создание тикета
export async function POST(request) {
  const { user, error } = await requireAuth(request);
  if (error) return error;

  const db = await getDb();
  const userId = user._id.toString();
  const now = new Date();

  // Rate limit: 5 тикетов в час
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentCount = await db
    .collection("tickets")
    .countDocuments({ userId, createdAt: { $gte: oneHourAgo } });

  if (recentCount >= 5) {
    return NextResponse.json(
      { error: "Слишком много обращений. Попробуйте позже." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const subject = (body.subject || "").trim().slice(0, 100);
  const message = (body.message || "").trim().slice(0, 1000);
  const imageUrl = (body.imageUrl || "").trim() || null;

  if (!subject || (!message && !imageUrl)) {
    return NextResponse.json(
      { error: "Заполните тему и сообщение" },
      { status: 400 }
    );
  }

  // Определяем ticketNumber — максимальный + 1
  const lastTicket = await db
    .collection("tickets")
    .find({}, { projection: { ticketNumber: 1 } })
    .sort({ ticketNumber: -1 })
    .limit(1)
    .toArray();
  const ticketNumber = (lastTicket[0]?.ticketNumber || 0) + 1;

  const ticket = {
    userId,
    subject,
    status: "open",
    ticketNumber,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };

  const result = await db.collection("tickets").insertOne(ticket);
  const ticketId = result.insertedId.toString();

  const firstMsg = {
    ticketId,
    senderId: userId,
    senderType: "user",
    text: message,
    createdAt: now,
  };
  if (imageUrl) firstMsg.imageUrl = imageUrl;

  await db.collection("ticket_messages").insertOne(firstMsg);

  return NextResponse.json({
    id: ticketId,
    ticketNumber,
    subject,
    status: "open",
    createdAt: now,
  });
}
