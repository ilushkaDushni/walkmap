import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

const FAKE_REVIEWS = [
  {
    rating: 5,
    text: "Потрясающее приложение! Открыл для себя столько новых мест в Ростове, о которых даже не подозревал. Маршруты составлены очень грамотно, каждая точка — это маленькое открытие. Рекомендую всем!",
  },
  {
    rating: 5,
    text: "Гуляли с друзьями по маршруту через Набережную — это было невероятно! Удобная навигация, красивые точки. Теперь каждые выходные выбираем новый маршрут.",
  },
  {
    rating: 4,
    text: "Классная идея с монетками за прохождение маршрутов, мотивирует гулять больше. Уже прошёл 7 маршрутов, хочу ещё! Единственное — хотелось бы больше маршрутов по Левому берегу.",
  },
  {
    rating: 5,
    text: "Лучшее приложение для прогулок по городу! Переехал в Ростов недавно и благодаря Ростов GO узнал город лучше, чем некоторые местные. Спасибо разработчикам!",
  },
  {
    rating: 4,
    text: "Очень нравится система достижений и лобби для совместных прогулок. Познакомился с кучей интересных людей. Жду новых маршрутов по историческому центру!",
  },
];

// POST /api/admin/seed-reviews — superadmin only, одноразовый посев
export async function POST(request) {
  const { error } = await requirePermission(request, "reviews.manage");
  if (error) return error;

  const db = await getDb();

  // Берём до 5 реальных пользователей для разнообразия
  const users = await db
    .collection("users")
    .find({}, { projection: { _id: 1, username: 1 } })
    .sort({ createdAt: 1 })
    .limit(5)
    .toArray();

  if (users.length === 0) {
    return NextResponse.json({ error: "Нет пользователей в базе" }, { status: 400 });
  }

  const now = Date.now();
  const docs = FAKE_REVIEWS.map((r, i) => ({
    userId: users[i % users.length]._id.toString(),
    rating: r.rating,
    text: r.text,
    featured: true,
    createdAt: new Date(now - i * 3600_000), // с интервалом в 1 час
  }));

  const result = await db.collection("reviews").insertMany(docs);

  return NextResponse.json({
    ok: true,
    inserted: result.insertedCount,
  });
}
