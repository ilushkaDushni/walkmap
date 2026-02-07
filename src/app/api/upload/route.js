import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ALLOWED = {
  photo: {
    mimes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: 10 * 1024 * 1024, // 10MB
    dir: "photos",
  },
  audio: {
    mimes: ["audio/mpeg", "audio/wav", "audio/ogg"],
    maxSize: 50 * 1024 * 1024, // 50MB
    dir: "audio",
  },
};

// POST /api/upload — загрузка файла (admin only)
export async function POST(request) {
  const { payload, error } = await requireAdmin(request);
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type"); // "photo" | "audio"

  if (!file || !type || !ALLOWED[type]) {
    return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
  }

  const config = ALLOWED[type];

  if (!config.mimes.includes(file.type)) {
    return NextResponse.json(
      { error: `Недопустимый формат. Разрешены: ${config.mimes.join(", ")}` },
      { status: 400 }
    );
  }

  if (file.size > config.maxSize) {
    return NextResponse.json(
      { error: `Файл слишком большой. Максимум: ${config.maxSize / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop().toLowerCase();
  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", config.dir);

  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  const url = `/uploads/${config.dir}/${filename}`;
  return NextResponse.json({ url });
}
