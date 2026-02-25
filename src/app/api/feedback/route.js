import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request) {
  try {
    const { name, email, message } = await request.json();

    if (!email || !message) {
      return NextResponse.json({ error: "Email и сообщение обязательны" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 1 || trimmedMessage.length > 1000) {
      return NextResponse.json({ error: "Сообщение от 1 до 1000 символов" }, { status: 400 });
    }

    const trimmedName = name ? name.trim().slice(0, 100) : "";

    // Rate-limit: 3 messages per hour per IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const db = await getDb();
    const col = db.collection("feedback_logs");

    // Ensure TTL index exists (idempotent)
    await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }).catch(() => {});

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await col.countDocuments({ ip, createdAt: { $gte: oneHourAgo } });

    if (recentCount >= 3) {
      return NextResponse.json(
        { error: "Слишком много сообщений. Попробуйте через час" },
        { status: 429 }
      );
    }

    // Save log
    await col.insertOne({
      ip,
      email,
      name: trimmedName,
      message: trimmedMessage,
      createdAt: new Date(),
    });

    // Send email via Resend
    const feedbackEmail = process.env.FEEDBACK_EMAIL;
    if (!feedbackEmail) {
      console.error("FEEDBACK_EMAIL not configured");
      return NextResponse.json({ error: "Сервис временно недоступен" }, { status: 500 });
    }

    const senderName = trimmedName || "Аноним";

    await resend.emails.send({
      from: "Ростов GO <noreply@malisha.website>",
      to: feedbackEmail,
      subject: `Обратная связь от ${senderName}`,
      replyTo: email,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Новое сообщение обратной связи</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666; vertical-align: top;">Имя:</td>
              <td style="padding: 8px;">${escapeHtml(senderName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666; vertical-align: top;">Email:</td>
              <td style="padding: 8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #666; vertical-align: top;">Сообщение:</td>
              <td style="padding: 8px; white-space: pre-wrap;">${escapeHtml(trimmedMessage)}</td>
            </tr>
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="font-size: 12px; color: #999;">Отправлено через форму обратной связи Ростов GO</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Feedback error:", e);
    return NextResponse.json({ error: "Ошибка отправки" }, { status: 500 });
  }
}
