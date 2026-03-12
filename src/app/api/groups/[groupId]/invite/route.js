import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/groups/[groupId]/invite — получить текущую ссылку
export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group || !group.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    // Ищем активный инвайт
    const invite = await db.collection("group_invites").findOne({
      groupId,
      expiresAt: { $gt: new Date() },
    });

    return NextResponse.json({ invite: invite ? { code: invite.code, expiresAt: invite.expiresAt, uses: invite.uses } : null });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST /api/groups/[groupId]/invite — создать/обновить инвайт-ссылку
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const member = group.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Только создатель или админ может создавать ссылки" }, { status: 403 });
    }

    const code = crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней

    // Деактивируем старые
    await db.collection("group_invites").updateMany(
      { groupId },
      { $set: { expiresAt: new Date() } }
    );

    await db.collection("group_invites").insertOne({
      groupId,
      groupName: group.name,
      code,
      createdBy: userId,
      uses: 0,
      maxUses: 0, // 0 = unlimited
      expiresAt,
      createdAt: new Date(),
    });

    return NextResponse.json({ code, expiresAt });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/groups/[groupId]/invite — отозвать инвайт
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const member = group.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    await db.collection("group_invites").updateMany(
      { groupId },
      { $set: { expiresAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
