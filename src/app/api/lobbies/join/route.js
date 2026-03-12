import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/lobbies/join — войти в лобби по коду
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { joinCode, role } = await request.json();
  const joinRole = role === "observer" ? "observer" : "participant";

  if (!joinCode || typeof joinCode !== "string" || joinCode.length !== 6) {
    return NextResponse.json({ error: "Некорректный код" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();

  const allowedStatuses = joinRole === "observer" ? ["waiting", "active"] : ["waiting"];
  const lobby = await db.collection("lobbies").findOne({
    joinCode: joinCode.toUpperCase(),
    status: { $in: allowedStatuses },
  });

  if (!lobby) {
    return NextResponse.json({ error: "Лобби не найдено или уже начато" }, { status: 404 });
  }

  // Уже участник?
  if (lobby.participants.some((p) => p.userId === userId)) {
    return NextResponse.json({
      id: lobby._id.toString(),
      message: "Вы уже в лобби",
    });
  }

  // Проверяем лимит (наблюдатели не считаются)
  const activeParticipants = lobby.participants.filter((p) => p.role !== "observer");
  if (joinRole !== "observer" && activeParticipants.length >= lobby.maxParticipants) {
    return NextResponse.json({ error: "Лобби заполнено" }, { status: 400 });
  }

  // Добавляем участника
  await db.collection("lobbies").updateOne(
    { _id: lobby._id },
    {
      $push: {
        participants: {
          userId,
          username: auth.user.username,
          avatarUrl: auth.user.avatarUrl || null,
          equippedItems: auth.user.equippedItems || null,
          role: joinRole,
          joinedAt: new Date(),
        },
      },
    }
  );

  return NextResponse.json({
    id: lobby._id.toString(),
    message: "Вы присоединились к лобби",
  });
}
