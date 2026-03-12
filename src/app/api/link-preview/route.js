import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/adminAuth";

// In-memory кэш превью ссылок
const previewCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 час
const MAX_CACHE_SIZE = 500;

function cleanExpired() {
  const now = Date.now();
  for (const [key, entry] of previewCache) {
    if (now - entry.ts > CACHE_TTL) previewCache.delete(key);
  }
}

// GET /api/link-preview?url=... — получение OG-метаданных для URL
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL обязателен" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Невалидный URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Только HTTP(S)" }, { status: 400 });
  }

  // Проверяем кэш
  cleanExpired();
  if (previewCache.has(url)) {
    return NextResponse.json(previewCache.get(url).data, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkPreview/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: "Не удалось загрузить" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "Не HTML" }, { status: 400 });
    }

    // Read only first 50KB to avoid downloading huge pages
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytesRead = 0;
    const maxBytes = 50000;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      bytesRead += value.length;
    }
    reader.cancel();

    const meta = extractOgMeta(html, parsed.origin);
    meta.domain = parsed.hostname.replace(/^www\./, "");
    meta.url = url;

    // Сохраняем в кэш
    if (previewCache.size >= MAX_CACHE_SIZE) {
      const oldest = previewCache.keys().next().value;
      previewCache.delete(oldest);
    }
    previewCache.set(url, { data: meta, ts: Date.now() });

    return NextResponse.json(meta, {
      headers: { "Cache-Control": "public, max-age=86400" },
    });
  } catch (err) {
    if (err.name === "AbortError") {
      return NextResponse.json({ error: "Таймаут" }, { status: 504 });
    }
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 502 });
  }
}

function extractOgMeta(html, origin) {
  const get = (property) => {
    // Match both property="og:..." and name="og:..."
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*?)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+(?:property|name)=["']${property}["']`, "i");
    return (html.match(re)?.[1] || html.match(re2)?.[1] || "").trim();
  };

  const title = get("og:title") || extractTitle(html);
  const description = get("og:description") || get("description");
  let image = get("og:image");
  const siteName = get("og:site_name");

  // Resolve relative image URLs
  if (image && !image.startsWith("http")) {
    try {
      image = new URL(image, origin).href;
    } catch {
      image = "";
    }
  }

  return {
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image: image || null,
    siteName: siteName.slice(0, 100) || null,
    url: origin,
  };
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return (match?.[1] || "").trim();
}
