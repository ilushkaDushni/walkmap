import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const db = await getDb();

    const leaders = await db.collection("completed_routes").aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
      { $addFields: { userObjId: { $toObjectId: "$_id" } } },
      { $lookup: { from: "users", localField: "userObjId", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, username: "$user.username", count: 1 } },
    ]).toArray();

    return NextResponse.json(leaders);
  } catch {
    return NextResponse.json([]);
  }
}
