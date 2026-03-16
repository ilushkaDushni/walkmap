import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/challenges/[id] — детали челленджа
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Некорректный ID" }, { status: 400 });
  }

  const db = await getDb();
  const challenge = await db.collection("challenges").findOne({ _id: new ObjectId(id) });
  if (!challenge) {
    return NextResponse.json({ error: "Вызов не найден" }, { status: 404 });
  }

  const userId = auth.user._id.toString();
  if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Подтягиваем данные
  const [challenger, challenged, route] = await Promise.all([
    db.collection("users").findOne({ _id: new ObjectId(challenge.challengerId) }, { projection: { username: 1, avatarUrl: 1, equippedItems: 1 } }),
    db.collection("users").findOne({ _id: new ObjectId(challenge.challengedId) }, { projection: { username: 1, avatarUrl: 1, equippedItems: 1 } }),
    ObjectId.isValid(challenge.routeId) ? db.collection("routes").findOne({ _id: new ObjectId(challenge.routeId) }, { projection: { title: 1, distance: 1 } }) : null,
  ]);

  return NextResponse.json({
    id: challenge._id.toString(),
    challengerId: challenge.challengerId,
    challengedId: challenge.challengedId,
    challengerUsername: challenger?.username || "?",
    challengerAvatarUrl: challenger?.avatarUrl || null,
    challengedUsername: challenged?.username || "?",
    challengedAvatarUrl: challenged?.avatarUrl || null,
    routeId: challenge.routeId,
    routeTitle: route?.title || "?",
    routeDistance: route?.distance || 0,
    status: challenge.status,
    stakeCoins: challenge.stakeCoins,
    challengerResult: challenge.challengerResult,
    challengedResult: challenge.challengedResult,
    winnerId: challenge.winnerId,
    expiresAt: challenge.expiresAt,
    resolvedAt: challenge.resolvedAt,
    createdAt: challenge.createdAt,
  });
}
