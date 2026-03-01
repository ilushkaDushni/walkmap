import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";
import { resolveUserPermissions } from "@/lib/permissions";

// GET /api/admin/users/[id]/bans — история банов пользователя
export async function GET(request, { params }) {
  const authResult = await requireAuth(request);
  if (authResult.error) return authResult.error;

  const { user: caller } = authResult;
  const callerPerms = await resolveUserPermissions(caller);

  if (!callerPerms.includes("users.ban")) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Невалидный ID" }, { status: 400 });
  }

  const db = await getDb();
  const history = await db
    .collection("ban_history")
    .find({ userId: id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json(
    history.map((h) => ({
      id: h._id.toString(),
      action: h.action,
      reason: h.reason,
      duration: h.duration,
      bannedBy: h.bannedBy,
      bannedByUsername: h.bannedByUsername,
      createdAt: h.createdAt,
    }))
  );
}
