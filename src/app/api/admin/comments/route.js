import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/comments — список комментариев с поиском и пагинацией
export async function GET(request) {
  const { error } = await requirePermission(request, "comments.manage");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const skip = parseInt(searchParams.get("skip") || "0", 10);
  const limit = 20;

  const db = await getDb();

  const match = {};
  if (q) {
    match.$or = [
      { text: { $regex: q, $options: "i" } },
      { "user.username": { $regex: q, $options: "i" } },
    ];
  }

  const pipeline = [
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        userObjId: { $toObjectId: "$userId" },
        routeObjId: { $toObjectId: "$routeId" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userObjId",
        foreignField: "_id",
        pipeline: [{ $project: { username: 1, avatarUrl: 1 } }],
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "routes",
        localField: "routeObjId",
        foreignField: "_id",
        pipeline: [{ $project: { title: 1 } }],
        as: "route",
      },
    },
    { $unwind: { path: "$route", preserveNullAndEmptyArrays: true } },
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    {
      $facet: {
        total: [{ $count: "count" }],
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              text: 1,
              createdAt: 1,
              parentId: 1,
              routeId: 1,
              userId: 1,
              "user.username": 1,
              "user.avatarUrl": 1,
              "route.title": 1,
            },
          },
        ],
      },
    },
  ];

  const [result] = await db.collection("comments").aggregate(pipeline).toArray();

  return NextResponse.json({
    items: result.items || [],
    total: result.total[0]?.count || 0,
  });
}
