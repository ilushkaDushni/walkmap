import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// POST /api/groups/[groupId]/members — добавить участника
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();
    const { memberId } = await request.json();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    const member = group.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Только создатель или админ может добавлять" }, { status: 403 });
    }

    if (group.members.some((m) => m.userId === memberId)) {
      return NextResponse.json({ error: "Уже в группе" }, { status: 400 });
    }

    if (group.members.length >= 50) {
      return NextResponse.json({ error: "Максимум 50 участников" }, { status: 400 });
    }

    // Проверяем дружбу
    const friendship = await db.collection("friendships").findOne({
      users: { $all: [userId, memberId] },
      status: "accepted",
    });
    if (!friendship) {
      return NextResponse.json({ error: "Можно добавлять только друзей" }, { status: 403 });
    }

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(groupId) },
      {
        $push: { members: { userId: memberId, role: "member", joinedAt: new Date() } },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// DELETE /api/groups/[groupId]/members — удалить участника или покинуть
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();
    const { memberId } = await request.json();

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    // Выход из группы
    if (memberId === userId) {
      if (group.createdBy === userId) {
        return NextResponse.json({ error: "Создатель не может покинуть группу. Удалите её." }, { status: 400 });
      }
      await db.collection("group_chats").updateOne(
        { _id: new ObjectId(groupId) },
        {
          $pull: { members: { userId } },
          $set: { updatedAt: new Date() },
        }
      );
      return NextResponse.json({ success: true });
    }

    // Кик участника — owner или admin
    const member = group.members.find((m) => m.userId === userId);
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return NextResponse.json({ error: "Только создатель или админ может удалять" }, { status: 403 });
    }

    // Админ не может кикать owner или другого админа
    const targetMember = group.members.find((m) => m.userId === memberId);
    if (member.role === "admin" && targetMember && (targetMember.role === "owner" || targetMember.role === "admin")) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(groupId) },
      {
        $pull: { members: { userId: memberId } },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
