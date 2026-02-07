import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const { username, email, password } = await request.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
  }

  const db = await getDb();

  // Проверка: email уже зарегистрирован?
  const existing = await db.collection("users").findOne({ email });
  if (existing) {
    return NextResponse.json({ error: "Email уже зарегистрирован" }, { status: 409 });
  }

  // Проверка: username занят?
  const existingName = await db.collection("users").findOne({ username });
  if (existingName) {
    return NextResponse.json({ error: "Логин уже занят" }, { status: 409 });
  }

  // Генерация 6-значного кода
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const passwordHash = await bcrypt.hash(password, 10);

  // Сохраняем pending-верификацию (перезаписываем если уже есть)
  await db.collection("pending_verifications").deleteMany({ email });
  await db.collection("pending_verifications").insertOne({
    username,
    email,
    passwordHash,
    code,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 минут
  });

  // Отправка письма
  try {
    await resend.emails.send({
      from: "noreply@malisha.website",
      to: email,
      subject: "Код подтверждения — Маршруты",
      html: `<h2>Ваш код подтверждения</h2><p style="font-size:32px;font-weight:bold;letter-spacing:4px">${code}</p><p>Код действителен 10 минут.</p>`,
    });
  } catch (e) {
    console.error("Resend error:", e);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }

  return NextResponse.json({ message: "Код отправлен на " + email });
}
