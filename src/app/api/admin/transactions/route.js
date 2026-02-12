import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/transactions — лог транзакций монет
export async function GET(request) {
  const { error } = await requirePermission(request, "users.manage_coins");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "";
  const type = searchParams.get("type") || "";
  const skip = parseInt(searchParams.get("skip") || "0", 10);
  const limit = 20;

  const db = await getDb();

  const match = {};
  if (userId) match.userId = userId;
  if (type) match.type = type;

  const pipeline = [
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        total: [{ $count: "count" }],
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $addFields: {
              userObjId: { $toObjectId: "$userId" },
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
        ],
      },
    },
  ];

  const [result] = await db.collection("coin_transactions").aggregate(pipeline).toArray();

  return NextResponse.json({
    items: result.items || [],
    total: result.total[0]?.count || 0,
  });
}
