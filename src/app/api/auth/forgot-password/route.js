import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Укажите email" }, { status: 400 });
  }

  const db = await getDb();
  const user = await db.collection("users").findOne({ email });

  // Не раскрываем, существует ли аккаунт
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await db.collection("password_resets").deleteMany({ email });
  await db.collection("password_resets").insertOne({
    email,
    userId: user._id.toString(),
    code,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  try {
    await resend.emails.send({
      from: "noreply@malisha.website",
      to: email,
      subject: "Сброс пароля — Ростов GO",
      html: `<h2>Код сброса пароля</h2><p style="font-size:32px;font-weight:bold;letter-spacing:4px">${code}</p><p>Код действителен 10 минут.</p><p>Если вы не запрашивали сброс, проигнорируйте это письмо.</p>`,
    });
  } catch (e) {
    console.error("Resend error:", e);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
