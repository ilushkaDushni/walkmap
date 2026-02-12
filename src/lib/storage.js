import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.YC_BUCKET_NAME || "rostov-go";
const ENDPOINT = "https://storage.yandexcloud.net";

const s3 = new S3Client({
  region: "ru-central1",
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Upload file to Yandex Cloud Object Storage.
 * @param {string} key — object key (e.g. "avatars/abc_123.webp")
 * @param {Buffer} buffer — file contents
 * @param {string} contentType — MIME type
 * @returns {string} public URL
 */
export async function uploadFile(key, buffer, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return `${ENDPOINT}/${BUCKET}/${key}`;
}

/**
 * Delete file from Yandex Cloud Object Storage by its public URL.
 * @param {string} url — full public URL
 */
export async function deleteFile(url) {
  if (!url) return;
  const prefix = `${ENDPOINT}/${BUCKET}/`;
  if (!url.startsWith(prefix)) return;
  const key = url.slice(prefix.length);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}
