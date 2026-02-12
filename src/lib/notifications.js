import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

/**
 * Создаёт уведомление для пользователя.
 * @param {string|ObjectId} userId — получатель
 * @param {string} type — тип: "achievement" | "admin_broadcast" | "comment_reply" | "friend_request" | "friend_accept" | "lobby_invite" | "coin_gift"
 * @param {object} data — данные, зависящие от типа
 */
export async function createNotification(userId, type, data = {}) {
  const db = await getDb();
  const uid = typeof userId === "string" ? userId : userId.toString();

  await db.collection("notifications").insertOne({
    userId: uid,
    type,
    data,
    read: false,
    createdAt: new Date(),
  });
}

/**
 * Создаёт уведомление для всех пользователей (broadcast).
 * @param {string} type
 * @param {object} data
 */
export async function createBroadcastNotification(type, data = {}) {
  const db = await getDb();
  const users = await db.collection("users").find({}, { projection: { _id: 1 } }).toArray();
  if (users.length === 0) return;

  const now = new Date();
  const docs = users.map((u) => ({
    userId: u._id.toString(),
    type,
    data,
    read: false,
    createdAt: now,
  }));

  await db.collection("notifications").insertMany(docs);
}
