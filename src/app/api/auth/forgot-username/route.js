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

  try {
    await resend.emails.send({
      from: "noreply@malisha.website",
      to: email,
      subject: "Ваш логин — Ростов GO",
      html: `<h2>Ваш логин</h2><p style="font-size:24px;font-weight:bold">${user.username}</p><p>Если вы не запрашивали это, проигнорируйте письмо.</p>`,
    });
  } catch (e) {
    console.error("Resend error:", e);
    return NextResponse.json({ error: "Не удалось отправить письмо" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
