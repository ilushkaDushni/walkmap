import aws4 from "aws4";
import { createHash } from "crypto";

const BUCKET = process.env.YC_BUCKET_NAME || "rostov-go";
const HOST = "storage.yandexcloud.net";
const ENDPOINT = `https://${HOST}`;
const S3_PREFIX = `${ENDPOINT}/${BUCKET}/`;

function credentials() {
  return {
    accessKeyId: process.env.YC_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY || "",
  };
}

/**
 * Sign and send request to Yandex Cloud Object Storage.
 */
async function s3fetch(method, key, body, headers = {}) {
  const opts = {
    host: HOST,
    path: `/${BUCKET}/${key}`,
    method,
    service: "s3",
    region: "ru-central1",
    headers: { ...headers },
  };

  if (body) {
    opts.body = body;
    opts.headers["x-amz-content-sha256"] = createHash("sha256").update(body).digest("hex");
  } else {
    opts.headers["x-amz-content-sha256"] = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // empty body hash
  }

  aws4.sign(opts, credentials());

  const res = await fetch(`${ENDPOINT}${opts.path}`, {
    method,
    headers: opts.headers,
    body: body || undefined,
  });

  return res;
}

/**
 * Extract S3 key from any URL format.
 * Handles: "/api/media/avatars/x.webp", "https://storage.yandexcloud.net/bucket/avatars/x.webp"
 */
export function s3KeyFromUrl(url) {
  if (!url) return null;
  if (url.startsWith("/api/media/")) return url.slice("/api/media/".length);
  if (url.startsWith(S3_PREFIX)) return url.slice(S3_PREFIX.length);
  return null;
}

/**
 * Convert any avatar/media URL to proxy format.
 * Legacy S3 URLs → /api/media/...
 */
export function toMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("/api/media/")) return url;
  if (url.startsWith(S3_PREFIX)) return `/api/media/${url.slice(S3_PREFIX.length)}`;
  return url;
}

/**
 * Upload file to Yandex Cloud Object Storage.
 * @param {string} key — object key (e.g. "avatars/abc_123.webp")
 * @param {Buffer} buffer — file contents
 * @param {string} contentType — MIME type
 * @returns {string} proxy URL ("/api/media/{key}")
 */
export async function uploadFile(key, buffer, contentType) {
  const res = await s3fetch("PUT", key, buffer, {
    "Content-Type": contentType,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`S3 PUT failed (${res.status}): ${text}`);
  }

  return `/api/media/${key}`;
}

/**
 * Get file from S3 by key.
 * @param {string} key — object key
 * @returns {{ body: ReadableStream, contentType: string }}
 */
export async function getFile(key) {
  const res = await s3fetch("GET", key);

  if (!res.ok) {
    throw new Error(`S3 GET failed (${res.status})`);
  }

  return {
    body: res,
    contentType: res.headers.get("content-type"),
  };
}

/**
 * Delete file from S3. Accepts any URL format (proxy or direct S3).
 * @param {string} url — proxy URL or full S3 URL
 */
export async function deleteFile(url) {
  const key = s3KeyFromUrl(url);
  if (!key) return;

  const res = await s3fetch("DELETE", key);
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`S3 DELETE failed (${res.status}): ${text}`);
  }
}
