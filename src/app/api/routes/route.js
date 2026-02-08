import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/adminAuth";
import { verifyAccessToken } from "@/lib/tokens";

// GET /api/routes — список маршрутов
export async function GET(request) {
  const db = await getDb();

  // Проверяем, админ ли запрашивает (если есть токен)
  let isAdmin = false;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const payload = await verifyAccessToken(auth.slice(7));
    if (payload?.role === "admin") isAdmin = true;
  }

  const filter = isAdmin ? {} : { status: "published" };
  const routes = await db
    .collection("routes")
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(routes);
}

// POST /api/routes — создать маршрут (admin only)
export async function POST(request) {
  const { payload, error } = await requireAdmin(request);
  if (error) return error;

  const db = await getDb();
  const now = new Date();

  const doc = {
    title: "Новый маршрут",
    description: "",
    intro: "",
    coverImage: "",
    distance: 0,
    duration: 0,
    path: [],
    checkpoints: [],
    segments: [],
    photos: [],
    audio: [],
    finish: null,
    mapCenter: { lat: 47.2357, lng: 39.7015 },
    mapZoom: 14,
    status: "draft",
    createdBy: payload.userId,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("routes").insertOne(doc);
  return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
}
