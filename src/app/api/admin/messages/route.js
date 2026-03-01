import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { requirePermission } from "@/lib/adminAuth";

// GET /api/admin/messages — список всех admin-диалогов для админов
export async function GET(request) {
  const { error } = await requirePermission(request, "feedback.manage");
  if (error) return error;

  const db = await getDb();

  // Агрегируем все admin_* conversations
  const conversations = await db.collection("messages").aggregate([
    { $match: { conversationKey: { $regex: /^admin_/ } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$conversationKey",
        lastMessage: { $first: "$$ROOT" },
        unreadFromUser: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$type", "admin"] }, { $eq: ["$readAt", null] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]).toArray();

  // Собираем userId из conversationKey (admin_{userId})
  const userIds = conversations.map((c) => {
    const uid = c._id.replace("admin_", "");
    try { return new ObjectId(uid); } catch { return null; }
  }).filter(Boolean);

  const users = userIds.length > 0
    ? await db.collection("users")
        .find({ _id: { $in: userIds } })
        .project({ username: 1, avatarUrl: 1 })
        .toArray()
    : [];

  const userMap = {};
  for (const u of users) {
    userMap[u._id.toString()] = u;
  }

  const serialized = conversations.map((c) => {
    const uid = c._id.replace("admin_", "");
    const u = userMap[uid] || {};
    const msg = c.lastMessage;

    return {
      conversationKey: c._id,
      userId: uid,
      username: u.username || "???",
      avatarUrl: u.avatarUrl || null,
      lastMessage: {
        text: msg.text,
        senderId: msg.senderId,
        type: msg.type,
        senderUsername: msg.senderUsername || null,
        createdAt: msg.createdAt,
      },
      unread: c.unreadFromUser,
    };
  });

  return NextResponse.json({ conversations: serialized });
}
