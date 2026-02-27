import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/tickets — все тикеты с пагинацией
export async function GET(request) {
  const { error } = await requirePermission(request, "feedback.manage");
  if (error) return error;

  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // "open" | "closed" | null (all)
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (status === "open" || status === "closed") filter.status = status;

  // Поиск по теме
  if (search) {
    filter.subject = { $regex: search, $options: "i" };
  }

  const [tickets, total] = await Promise.all([
    db
      .collection("tickets")
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection("tickets").countDocuments(filter),
  ]);

  // Lookup users
  const userIds = [...new Set(tickets.map((t) => t.userId))];
  const users = await db
    .collection("users")
    .find(
      { _id: { $in: userIds.map((id) => new ObjectId(id)) } },
      { projection: { username: 1, avatarUrl: 1 } }
    )
    .toArray();

  const userMap = {};
  for (const u of users) {
    userMap[u._id.toString()] = { username: u.username, avatarUrl: u.avatarUrl || null };
  }

  // Подсчёт сообщений
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
    subject: t.subject,
    status: t.status,
    userId: t.userId,
    user: userMap[t.userId] || { username: "Удалён", avatarUrl: null },
    messageCount: countMap[t._id.toString()] || 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return NextResponse.json({ tickets: result, total, page, pages: Math.ceil(total / limit) });
}
