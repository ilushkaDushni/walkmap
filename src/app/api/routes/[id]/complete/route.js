import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Неверный ID маршрута" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const routeId = new ObjectId(id);

    // Проверяем что маршрут существует
    const route = await db.collection("routes").findOne({ _id: routeId });
    if (!route) {
      return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    }

    const userId = auth.user._id.toString();

    // Проверяем дубликат
    const existing = await db.collection("completed_routes").findOne({
      userId,
      routeId: id,
    });
    if (existing) {
      return NextResponse.json({ alreadyCompleted: true });
    }

    // Считаем максимум монет из маршрута
    const body = await request.json().catch(() => ({}));
    const checkpointCoins = (route.checkpoints || []).reduce((s, cp) => s + (cp.coinsReward || 0), 0);
    const finishCoins = route.finish?.coinsReward || 0;
    const maxPossibleCoins = checkpointCoins + finishCoins;
    const coins = Math.min(body.coins || 0, maxPossibleCoins);

    // Записываем прохождение
    await db.collection("completed_routes").insertOne({
      userId,
      routeId: id,
      completedAt: new Date(),
      coinsEarned: coins,
    });

    // Начисляем монеты
    if (coins > 0) {
      await db.collection("users").updateOne(
        { _id: auth.user._id },
        { $inc: { coins } }
      );
    }

    return NextResponse.json({ success: true, coins });
  } catch (e) {
    console.error("Route complete error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
