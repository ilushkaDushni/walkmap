import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/routes/[id]/records — рекорды прохождения маршрута
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Неверный ID" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    // Топ-10 по времени (только GPS-верифицированные с duration)
    const records = await db.collection("completed_routes").aggregate([
      { $match: { routeId: id, gpsVerified: true, duration: { $gt: 0 } } },
      { $sort: { duration: 1 } },
      { $limit: 10 },
      { $addFields: { userObjId: { $toObjectId: "$userId" } } },
      {
        $lookup: {
          from: "users",
          localField: "userObjId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: 1,
          duration: 1,
          pace: 1,
          completedAt: 1,
          username: "$user.username",
          avatarUrl: { $ifNull: ["$user.avatarUrl", null] },
          equippedItems: { $ifNull: ["$user.equippedItems", {}] },
        },
      },
    ]).toArray();

    // Мой лучший результат
    const myBest = await db.collection("completed_routes").findOne(
      { routeId: id, userId, gpsVerified: true, duration: { $gt: 0 } },
      { sort: { duration: 1 } }
    );

    // Место юзера в рейтинге
    let myRank = null;
    if (myBest) {
      const betterCount = await db.collection("completed_routes").countDocuments({
        routeId: id,
        gpsVerified: true,
        duration: { $gt: 0, $lt: myBest.duration },
      });
      myRank = betterCount + 1;
    }

    // Общее число прохождений маршрута
    const totalCompletions = await db.collection("completed_routes").countDocuments({ routeId: id });

    return NextResponse.json({
      records,
      myBest: myBest
        ? { duration: myBest.duration, pace: myBest.pace, rank: myRank, completedAt: myBest.completedAt }
        : null,
      totalCompletions,
    });
  } catch (e) {
    console.error("Records error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
