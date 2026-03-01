import { MongoClient, ObjectId } from "mongodb";

const uri = "mongodb://localhost:27017/pepe";
const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db("pepe");

  // Находим суперадмина
  const superadmin = await db.collection("users").findOne({ email: "iluxaonstyle@gmail.com" });
  if (!superadmin) {
    console.log("Суперадмин не найден!");
    process.exit(1);
  }

  const userId = superadmin._id.toString();
  console.log(`Найден пользователь: ${superadmin.username} (${userId})`);

  const conversationKey = `admin_${userId}`;
  const now = new Date();

  // 1. Тестовое приветственное сообщение от админа
  const msg1 = {
    conversationKey,
    senderId: userId, // от имени админа (тот же юзер, но type: admin)
    text: "Здравствуйте! Это тестовое сообщение от администрации. Добро пожаловать в Ростов GO!",
    type: "admin",
    senderUsername: superadmin.username,
    readAt: null,
    createdAt: new Date(now.getTime() - 60000), // 1 мин назад
  };

  // 2. Предупреждение о нарушении
  const msg2 = {
    conversationKey,
    senderId: userId,
    text: "⚠️ ПРЕДУПРЕЖДЕНИЕ: Ваш аккаунт получил предупреждение за нарушение правил сообщества. Пожалуйста, ознакомьтесь с правилами. При повторном нарушении аккаунт может быть заблокирован.",
    type: "admin",
    senderUsername: superadmin.username,
    readAt: null,
    createdAt: now,
  };

  await db.collection("messages").insertMany([msg1, msg2]);
  console.log("Вставлено 2 admin-сообщения в conversationKey:", conversationKey);

  // 3. Notification для тоста
  await db.collection("notifications").insertOne({
    userId: new ObjectId(userId),
    type: "admin_message",
    data: {
      conversationKey,
      adminUsername: superadmin.username,
      text: "⚠️ ПРЕДУПРЕЖДЕНИЕ: Ваш аккаунт получил предупреждение...",
    },
    read: false,
    createdAt: now,
  });
  console.log("Создана notification admin_message");

  console.log("\nГотово! Теперь:");
  console.log("1. Откройте /friends — должен появиться блок 'Администрация' с бейджем 2");
  console.log("2. Нажмите на него — увидите 2 сообщения в чате");
  console.log("3. При следующем polling тост должен появиться");

  await client.close();
}

main().catch(console.error);
