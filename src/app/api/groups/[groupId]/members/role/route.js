import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// PATCH /api/groups/[groupId]/members/role — назначить/снять роль admin
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { groupId } = await params;
    const userId = auth.user._id.toString();
    const { memberId, role } = await request.json();

    if (!memberId || !["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Неверные параметры" }, { status: 400 });
    }

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    // Только owner может назначать роли
    const caller = group.members.find((m) => m.userId === userId);
    if (!caller || caller.role !== "owner") {
      return NextResponse.json({ error: "Только создатель может назначать роли" }, { status: 403 });
    }

    const target = group.members.find((m) => m.userId === memberId);
    if (!target) {
      return NextResponse.json({ error: "Участник не найден" }, { status: 404 });
    }

    if (target.role === "owner") {
      return NextResponse.json({ error: "Нельзя изменить роль создателя" }, { status: 400 });
    }

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(groupId), "members.userId": memberId },
      { $set: { "members.$.role": role, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, role });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
