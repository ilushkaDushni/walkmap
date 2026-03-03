import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { getDb } from "@/lib/mongodb";
import { logCoinTransaction } from "@/lib/coinTransactions";
import { createNotification } from "@/lib/notifications";
import { ACHIEVEMENT_MAP } from "@/lib/achievements";

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Введите промокод" }, { status: 400 });
  }

  const db = await getDb();
  const userId = auth.user._id.toString();
  const normalizedCode = code.trim().toUpperCase();

  // Найти промокод
  const promo = await db.collection("promo_codes").findOne({ code: normalizedCode });
  if (!promo) {
    return NextResponse.json({ error: "Промокод не найден" }, { status: 404 });
  }

  // Проверки
  if (!promo.isActive) {
    return NextResponse.json({ error: "Промокод неактивен" }, { status: 400 });
  }
  if (promo.expiresAt && new Date() > promo.expiresAt) {
    return NextResponse.json({ error: "Промокод истёк" }, { status: 400 });
  }
  if (promo.usedBy?.includes(userId)) {
    return NextResponse.json({ error: "Вы уже активировали этот промокод" }, { status: 400 });
  }
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ error: "Промокод исчерпан" }, { status: 400 });
  }

  // Атомарно обновить промокод (с повторной проверкой дедупликации)
  const promoUpdate = await db.collection("promo_codes").updateOne(
    {
      _id: promo._id,
      usedBy: { $ne: userId },
      ...(promo.maxUses > 0 ? { usedCount: { $lt: promo.maxUses } } : {}),
    },
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: userId },
    }
  );

  if (promoUpdate.modifiedCount === 0) {
    return NextResponse.json({ error: "Не удалось активировать промокод" }, { status: 400 });
  }

  // Начислить монеты + достижение
  const userUpdate = { $inc: { coins: promo.reward } };

  if (promo.achievementSlug && ACHIEVEMENT_MAP[promo.achievementSlug]) {
    const alreadyHas = auth.user.achievements?.some((a) => a.slug === promo.achievementSlug);
    if (!alreadyHas) {
      userUpdate.$push = {
        achievements: {
          slug: promo.achievementSlug,
          unlockedAt: new Date(),
          rewardClaimed: true,
        },
      };
    }
  }

  const updatedUser = await db.collection("users").findOneAndUpdate(
    { _id: auth.user._id },
    userUpdate,
    { returnDocument: "after" }
  );

  // Логировать транзакцию
  await logCoinTransaction(db, {
    userId,
    type: "promo_code",
    amount: promo.reward,
    balance: updatedUser.coins,
    meta: { code: promo.code, achievementSlug: promo.achievementSlug },
  });

  // Уведомление о достижении
  if (promo.achievementSlug && ACHIEVEMENT_MAP[promo.achievementSlug]) {
    const ach = ACHIEVEMENT_MAP[promo.achievementSlug];
    await createNotification(userId, "achievement", {
      achievementSlug: promo.achievementSlug,
      title: ach.title,
      reward: promo.reward,
    });
  }

  return NextResponse.json({
    success: true,
    reward: promo.reward,
    achievement: promo.achievementSlug || null,
    newBalance: updatedUser.coins,
  });
}
