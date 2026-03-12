import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/groups/[groupId] — получить инфо о группе
export async function GET(request, { params }) {
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

    const isMember = group.members.some((m) => m.userId === userId);
    if (!isMember) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    // Подгружаем юзеров-участников
    const memberIds = group.members.map((m) => new ObjectId(m.userId));
    const users = await db.collection("users")
      .find({ _id: { $in: memberIds } })
      .project({ _id: 1, username: 1, avatarUrl: 1, lastActivityAt: 1, equippedItems: 1 })
      .toArray();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const members = group.members.map((m) => {
      const u = userMap[m.userId];
      return {
        userId: m.userId,
        role: m.role,
        username: u?.username || "Удалён",
        avatarUrl: u?.avatarUrl || null,
        lastActivityAt: u?.lastActivityAt || null,
        equippedItems: u?.equippedItems || {},
        joinedAt: m.joinedAt,
      };
    });

    return NextResponse.json({
      id: group._id.toString(),
      name: group.name,
      description: group.description || null,
      avatarUrl: group.avatarUrl || null,
      members,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// PATCH /api/groups/[groupId] — обновить название группы
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();
    const body = await request.json();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const member = group.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Только создатель или админ может редактировать" }, { status: 403 });
    }

    const updates = { updatedAt: new Date() };

    if (body.name !== undefined) {
      const name = body.name;
      if (!name || name.trim().length < 1 || name.trim().length > 50) {
        return NextResponse.json({ error: "Название 1-50 символов" }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (body.description !== undefined) {
      const desc = (body.description || "").trim();
      if (desc.length > 200) {
        return NextResponse.json({ error: "Описание максимум 200 символов" }, { status: 400 });
      }
      updates.description = desc || null;
    }

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(groupId) },
      { $set: updates }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/groups/[groupId] — удалить группу
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

    if (group.createdBy !== userId) {
      return NextResponse.json({ error: "Только создатель может удалить" }, { status: 403 });
    }

    await Promise.all([
      db.collection("group_chats").deleteOne({ _id: new ObjectId(groupId) }),
      db.collection("group_messages").deleteMany({ groupId }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
