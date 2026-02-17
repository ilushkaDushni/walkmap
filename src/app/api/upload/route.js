import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/adminAuth";
import { randomBytes } from "crypto";
import { uploadFile, deleteFile, s3KeyFromUrl } from "@/lib/storage";

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

// POST /api/upload — загрузка файла в S3 (admin only)
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
  const key = `${config.dir}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    console.log("[upload] key:", key, "size:", buffer.length, "type:", file.type);
    const url = await uploadFile(key, buffer, file.type);
    console.log("[upload] success:", url);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload] FAILED:", err?.Code || err?.name || err?.message, err);
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 });
  }
}

// DELETE /api/upload — удаление файла (admin only)
export async function DELETE(request) {
  const { error } = await requirePermission(request, "upload.files");
  if (error) return error;

  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL не указан" }, { status: 400 });
  }

  // S3 file (/api/media/... or direct S3 URL)
  const key = s3KeyFromUrl(url);
  if (key) {
    try {
      await deleteFile(url);
    } catch {
      // file may already be deleted
    }
    return NextResponse.json({ ok: true });
  }

  // Legacy: local file deletion (/api/uploads/...)
  const prefix = "/api/uploads/";
  if (url.includes(prefix)) {
    const { unlink } = await import("fs/promises");
    const path = await import("path");
    const UPLOADS_DIR = path.default.resolve(process.cwd(), "uploads");
    const relativePath = url.split(prefix).pop();
    const filePath = path.default.resolve(UPLOADS_DIR, relativePath);

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

  return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
}
