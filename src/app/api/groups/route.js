import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/groups — список групп пользователя
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();

    const groups = await db.collection("group_chats")
      .find({ "members.userId": userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const serialized = groups.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      avatarUrl: g.avatarUrl || null,
      memberCount: g.members.length,
      lastMessage: g.lastMessage || null,
      updatedAt: g.updatedAt || g.createdAt,
      createdBy: g.createdBy,
      isOwner: g.createdBy === userId,
    }));

    return NextResponse.json({ groups: serialized });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

// POST /api/groups — создать группу
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const db = await getDb();
    const userId = auth.user._id.toString();
    const { name, memberIds } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "Максимум 50 символов" }, { status: 400 });
    }

    // Проверяем что все memberIds — друзья
    const friendIds = Array.isArray(memberIds) ? memberIds.filter((id) => id !== userId) : [];
    if (friendIds.length === 0) {
      return NextResponse.json({ error: "Добавьте хотя бы одного участника" }, { status: 400 });
    }
    if (friendIds.length > 50) {
      return NextResponse.json({ error: "Максимум 50 участников" }, { status: 400 });
    }

    // Проверяем дружбу
    const friendships = await db.collection("friendships")
      .find({
        users: { $all: [userId] },
        status: "accepted",
      })
      .toArray();
    const myFriendIds = new Set(friendships.flatMap((f) => f.users.filter((id) => id !== userId)));
    const validMembers = friendIds.filter((id) => myFriendIds.has(id));

    if (validMembers.length === 0) {
      return NextResponse.json({ error: "Участники должны быть вашими друзьями" }, { status: 400 });
    }

    const allMembers = [userId, ...validMembers];
    const members = allMembers.map((id) => ({
      userId: id,
      role: id === userId ? "owner" : "member",
      joinedAt: new Date(),
    }));

    const group = {
      name: name.trim(),
      avatarUrl: null,
      members,
      createdBy: userId,
      lastMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("group_chats").insertOne(group);

    return NextResponse.json({
      id: result.insertedId.toString(),
      name: group.name,
      avatarUrl: null,
      memberCount: members.length,
      lastMessage: null,
      updatedAt: group.updatedAt,
      createdBy: userId,
      isOwner: true,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
