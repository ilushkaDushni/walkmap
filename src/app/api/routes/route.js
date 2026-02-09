import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requirePermission, requireAuth } from "@/lib/adminAuth";

// GET /api/routes — список маршрутов
export async function GET(request) {
  const db = await getDb();

  // Проверяем, есть ли у юзера право видеть скрытые
  let canViewHidden = false;
  const authResult = await requireAuth(request);
  if (!authResult.error) {
    const { resolveUserPermissions } = await import("@/lib/permissions");
    const perms = await resolveUserPermissions(authResult.user);
    canViewHidden = perms.includes("routes.view_hidden");
  }

  const filter = canViewHidden ? {} : { status: "published" };
  const routes = await db
    .collection("routes")
    .find(filter)
    .sort({ sortOrder: 1, createdAt: -1 })
    .toArray();

  return NextResponse.json(routes);
}

// POST /api/routes — создать маршрут
export async function POST(request) {
  const { user, error } = await requirePermission(request, "routes.create");
  if (error) return error;

  const db = await getDb();
  const now = new Date();

  const doc = {
    title: "Новый маршрут",
    description: "",
    intro: "",
    coverImage: null,
    distance: 0,
    duration: 0,
    path: [],
    checkpoints: [],
    segments: [],
    branches: [],
    photos: [],
    audio: [],
    finish: null,
    mapCenter: { lat: 47.2357, lng: 39.7015 },
    mapZoom: 14,
    folderIds: [],
    sortOrder: 0,
    status: "draft",
    createdBy: user._id.toString(),
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("routes").insertOne(doc);
  return NextResponse.json({ ...doc, _id: result.insertedId }, { status: 201 });
}
