import { NextResponse } from "next/server";
import { getFile } from "@/lib/storage";

const ALLOWED_PREFIXES = ["avatars/", "photos/", "audio/"];

// GET /api/media/:path — proxy S3 objects through the server
export async function GET(request, { params }) {
  const segments = (await params).path;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = segments.join("/");

  if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { body, contentType } = await getFile(key);
    const arrayBuf = await body.arrayBuffer();

    return new Response(arrayBuf, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
