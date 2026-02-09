import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminAuth";

// GET /api/folders — все папки
export async function GET() {
  const db = await getDb();
  const folders = await db
    .collection("folders")
    .find({})
    .sort({ sortOrder: 1 })
    .toArray();

  return NextResponse.json(folders);
}

// POST /api/folders — создать папку (admin)
export async function POST(request) {
  const { payload, error } = await requireAdmin(request);
  if (error) return error;

  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();

  // sortOrder = max + 1
  const last = await db
    .collection("folders")
    .find({})
    .sort({ sortOrder: -1 })
    .limit(1)
    .toArray();
  const sortOrder = last.length > 0 ? (last[0].sortOrder || 0) + 1 : 0;

  const doc = {
    name: name.trim(),
    sortOrder,
    adminOnly: false,
    exceptions: [],
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("folders").insertOne(doc);
  return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
}
