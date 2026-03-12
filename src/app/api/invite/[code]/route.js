import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/invite/[code] — инфо об инвайте
export async function GET(request, { params }) {
  try {
    const db = await getDb();
    const { code } = await params;

    const invite = await db.collection("group_invites").findOne({
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return NextResponse.json({ error: "Ссылка недействительна или истекла" }, { status: 404 });
    }

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(invite.groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      groupName: group.name,
      groupAvatarUrl: group.avatarUrl || null,
      memberCount: group.members.length,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST /api/invite/[code] — присоединиться к группе по инвайту
export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const { code } = await params;
    const userId = auth.user._id.toString();

    const invite = await db.collection("group_invites").findOne({
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return NextResponse.json({ error: "Ссылка недействительна или истекла" }, { status: 404 });
    }

    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: "Лимит использований исчерпан" }, { status: 400 });
    }

    const group = await db.collection("group_chats").findOne({ _id: new ObjectId(invite.groupId) });
    if (!group) {
      return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
    }

    if (group.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Вы уже в этой группе", groupId: invite.groupId }, { status: 400 });
    }

    if (group.members.length >= 50) {
      return NextResponse.json({ error: "Группа заполнена (макс. 50)" }, { status: 400 });
    }

    await db.collection("group_chats").updateOne(
      { _id: new ObjectId(invite.groupId) },
      {
        $push: { members: { userId, role: "member", joinedAt: new Date() } },
        $set: { updatedAt: new Date() },
      }
    );

    await db.collection("group_invites").updateOne(
      { _id: invite._id },
      { $inc: { uses: 1 } }
    );

    return NextResponse.json({ success: true, groupId: invite.groupId });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
