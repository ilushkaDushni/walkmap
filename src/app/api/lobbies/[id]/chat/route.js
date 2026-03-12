import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

const QUICK_REACTIONS = ["Я на месте!", "Подождите", "Вперёд!", "👍", "😂"];

// GET /api/lobbies/[id]/chat — получить сообщения мини-чата лобби
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || !lobby.participants.some((p) => p.userId === userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");

  const filter = { lobbyId: id };
  if (after) {
    filter.createdAt = { $gt: new Date(after) };
  }

  const messages = await db.collection("lobby_messages")
    .find(filter)
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray();

  const serialized = messages.map((m) => ({
    id: m._id.toString(),
    senderId: m.senderId,
    senderUsername: m.senderUsername,
    text: m.text,
    createdAt: m.createdAt,
  }));

  return NextResponse.json({ messages: serialized });
}

// POST /api/lobbies/[id]/chat — отправить сообщение в мини-чат
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();
  const lobby = await db.collection("lobbies").findOne({ _id: new ObjectId(id) });

  if (!lobby || !lobby.participants.some((p) => p.userId === userId)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (!["waiting", "active"].includes(lobby.status)) {
    return NextResponse.json({ error: "Лобби неактивно" }, { status: 400 });
  }

  const { text } = await request.json();
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Текст обязателен" }, { status: 400 });
  }

  const trimmed = text.trim().slice(0, 200);

  const message = {
    lobbyId: id,
    senderId: userId,
    senderUsername: auth.user.username,
    text: trimmed,
    createdAt: new Date(),
  };

  const result = await db.collection("lobby_messages").insertOne(message);

  return NextResponse.json({
    id: result.insertedId.toString(),
    senderId: userId,
    senderUsername: auth.user.username,
    text: trimmed,
    createdAt: message.createdAt,
  }, { status: 201 });
}
