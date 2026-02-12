import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/lobbies — активные лобби
export async function GET(request) {
  const { error } = await requirePermission(request, "admin.access");
  if (error) return error;

  const db = await getDb();

  const pipeline = [
    { $match: { status: "active" } },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        routeObjId: { $toObjectId: "$routeId" },
        hostObjId: { $toObjectId: "$hostId" },
      },
    },
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
    {
      $lookup: {
        from: "users",
        localField: "hostObjId",
        foreignField: "_id",
        pipeline: [{ $project: { username: 1, avatarUrl: 1 } }],
        as: "host",
      },
    },
    { $unwind: { path: "$host", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        joinCode: 1,
        status: 1,
        createdAt: 1,
        expiresAt: 1,
        hostId: 1,
        routeId: 1,
        participants: 1,
        "route.title": 1,
        "host.username": 1,
        "host.avatarUrl": 1,
      },
    },
  ];

  const lobbies = await db.collection("lobbies").aggregate(pipeline).toArray();

  return NextResponse.json(lobbies);
}
