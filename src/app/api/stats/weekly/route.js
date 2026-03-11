import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/stats/weekly — недельная статистика пользователя
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Понедельник
    startOfWeek.setHours(0, 0, 0, 0);

    // Данные за каждый день недели
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      days.push({ start: dayStart, end: dayEnd });
    }

    const [weekCompletions, prevWeekCompletions] = await Promise.all([
      // Завершения за текущую неделю
      db.collection("completed_routes")
        .find({
          userId,
          gpsVerified: true,
          completedAt: { $gte: startOfWeek },
        })
        .toArray(),

      // Завершения за прошлую неделю (для сравнения)
      db.collection("completed_routes")
        .countDocuments({
          userId,
          gpsVerified: true,
          completedAt: {
            $gte: new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
            $lt: startOfWeek,
          },
        }),
    ]);

    // Подсчёт дистанции по дням
    const routeIds = [...new Set(weekCompletions.map((c) => c.routeId))];
    let routeDistances = {};
    if (routeIds.length > 0) {
      const { ObjectId } = await import("mongodb");
      const routes = await db.collection("routes")
        .find({ _id: { $in: routeIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, distance: 1 })
        .toArray();
      for (const r of routes) {
        routeDistances[r._id.toString()] = r.distance || 0;
      }
    }

    const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const dailyStats = days.map((day, i) => {
      const dayCompletions = weekCompletions.filter((c) => {
        const t = new Date(c.completedAt);
        return t >= day.start && t < day.end;
      });
      const distance = dayCompletions.reduce((sum, c) => sum + (routeDistances[c.routeId] || 0), 0);
      return {
        day: dayLabels[i],
        routes: dayCompletions.length,
        distanceM: distance,
      };
    });

    const totalRoutes = weekCompletions.length;
    const totalDistanceM = dailyStats.reduce((sum, d) => sum + d.distanceM, 0);

    return NextResponse.json({
      dailyStats,
      totalRoutes,
      totalDistanceM,
      prevWeekRoutes: prevWeekCompletions,
      streak: calculateStreak(dailyStats, now, startOfWeek),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

function calculateStreak(dailyStats, now, startOfWeek) {
  const todayIndex = Math.min(
    Math.floor((now - startOfWeek) / (24 * 60 * 60 * 1000)),
    6
  );
  let streak = 0;
  for (let i = todayIndex; i >= 0; i--) {
    if (dailyStats[i].routes > 0) streak++;
    else break;
  }
  return streak;
}
