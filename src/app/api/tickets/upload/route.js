import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";
import { randomBytes } from "crypto";
import { uploadFile } from "@/lib/storage";

// POST /api/tickets/upload — загрузка фото для тикетов (авторизованные юзеры)
export async function POST(request) {
  const { error } = await requireAuth(request);
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  }

  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(file.type)) {
    return NextResponse.json(
      { error: "Допустимы только изображения (JPEG, PNG, WebP)" },
      { status: 400 }
    );
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "Максимальный размер — 5 МБ" }, { status: 400 });
  }

  const ext = file.name.split(".").pop().toLowerCase();
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  const key = `ticket-photos/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadFile(key, buffer, file.type);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}
