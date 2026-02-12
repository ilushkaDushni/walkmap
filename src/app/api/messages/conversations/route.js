import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requireAuth } from "@/lib/adminAuth";

// GET /api/messages/conversations — список диалогов + last message + unread count
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const db = await getDb();
  const userId = auth.user._id.toString();

  // Получаем все сообщения пользователя, группируем по conversationKey
  const conversations = await db.collection("messages").aggregate([
    {
      $match: {
        $or: [
          { conversationKey: { $regex: `^${userId}_` } },
          { conversationKey: { $regex: `_${userId}$` } },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$conversationKey",
        lastMessage: { $first: "$$ROOT" },
        unread: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$senderId", userId] }, { $eq: ["$readAt", null] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]).toArray();

  // Собираем ID собеседников
  const friendIds = conversations.map((c) => {
    const parts = c._id.split("_");
    return parts[0] === userId ? parts[1] : parts[0];
  });

  // Загружаем данные собеседников
  const friends = friendIds.length > 0
    ? await db.collection("users")
        .find({ _id: { $in: friendIds.map((id) => new ObjectId(id)) } })
        .project({ username: 1, avatarUrl: 1 })
        .toArray()
    : [];

  const friendMap = {};
  for (const f of friends) {
    friendMap[f._id.toString()] = f;
  }

  const serialized = conversations.map((c) => {
    const parts = c._id.split("_");
    const friendId = parts[0] === userId ? parts[1] : parts[0];
    const friend = friendMap[friendId] || {};
    const msg = c.lastMessage;

    return {
      conversationKey: c._id,
      friendId,
      friendUsername: friend.username || "???",
      friendAvatarUrl: friend.avatarUrl || null,
      lastMessage: {
        text: msg.text,
        senderId: msg.senderId,
        createdAt: msg.createdAt,
        routeId: msg.routeId || null,
      },
      unread: c.unread,
    };
  });

  return NextResponse.json({ conversations: serialized });
}
