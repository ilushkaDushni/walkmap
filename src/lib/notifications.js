import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";
import { pushNotification } from "./sse";

/**
 * Создаёт уведомление для пользователя.
 * @param {string|ObjectId} userId — получатель
 * @param {string} type — тип
 * @param {object} data — данные, зависящие от типа
 * @returns {string} — _id созданного уведомления
 */
export async function createNotification(userId, type, data = {}) {
  const db = await getDb();
  const uid = typeof userId === "string" ? userId : userId.toString();

  const result = await db.collection("notifications").insertOne({
    userId: uid,
    type,
    data,
    read: false,
    createdAt: new Date(),
  });

  return result.insertedId.toString();
}

/**
 * Создаёт уведомление + пушит через SSE с notificationId для дедупликации.
 * Заменяет паттерн createNotification() + pushNotification().
 */
export async function createAndPushNotification(userId, type, data = {}) {
  const notificationId = await createNotification(userId, type, data);
  pushNotification(userId, { type, notificationId, ...data });
  return notificationId;
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
