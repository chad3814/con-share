import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";

export const s3 = new S3Client({
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extForContentType(contentType: string): string {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  return ext;
}

export function photoKeys(conventionId: string, photoId: string, originalExt: string) {
  const base = `conventions/${conventionId}/photos/${photoId}`;
  return {
    original: `${base}/original.${originalExt}`,
    exif: `${base}/metadata.exif`,
    web: `${base}/web.webp`,
    thumb: `${base}/thumb.webp`,
  };
}

export function photoKeysFromOriginal(
  originalKey: string,
): { original: string; exif: string; web: string; thumb: string } | null {
  const match = originalKey.match(/^(.*)\/original\.[^/]+$/);
  if (!match) return null;
  const base = match[1];
  return {
    original: originalKey,
    exif: `${base}/metadata.exif`,
    web: `${base}/web.webp`,
    thumb: `${base}/thumb.webp`,
  };
}

export function conventionLogoKey(conventionId: string): string {
  return `conventions/${conventionId}/logo.webp`;
}

export function publicUrl(key: string): string {
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

// Note on ContentLength: binding the presigned PUT to an exact size means the
// browser must know the exact byte length ahead of time (it does here, since
// files are read into memory client-side before upload). If that assumption
// ever breaks, relax this to a content-length-range policy condition or drop
// it and rely on the DB-side cap + a post-upload size check instead.
export async function presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(s3, command, { expiresIn: 600 });
}

// Not part of Task 1's consumed interface (upload flow calls presignPut and
// lets the client PUT directly to S3), but kept as a small server-side write
// helper for later tasks (e.g. writing derived web/thumb variants).
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
