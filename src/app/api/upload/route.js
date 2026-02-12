import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/adminAuth";
import { randomBytes } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

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
  const { error } = await requirePermission(request, "upload.files");
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

  const dirPath = path.join(UPLOADS_DIR, config.dir);
  await mkdir(dirPath, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dirPath, filename), buffer);

  const url = `/api/uploads/${config.dir}/${filename}`;

  return NextResponse.json({ url });
}

// DELETE /api/upload — удаление файла (admin only)
export async function DELETE(request) {
  const { error } = await requirePermission(request, "upload.files");
  if (error) return error;

  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL не указан" }, { status: 400 });
  }

  // extract relative path from URL like /api/uploads/photos/xxx.jpg
  const prefix = "/api/uploads/";
  if (!url.includes(prefix)) {
    return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
  }

  const relativePath = url.split(prefix).pop();
  const filePath = path.resolve(UPLOADS_DIR, relativePath);

  // path traversal protection
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await unlink(filePath);
  } catch {
    // file may already be deleted
  }

  return NextResponse.json({ ok: true });
}
