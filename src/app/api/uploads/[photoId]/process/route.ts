import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getObjectBytes, publicUrl, putObject } from "@/lib/s3";
import { processImage } from "@/lib/image";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { photoId } = await params;
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (photo.uploaderId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const base = photo.originalKey.replace(/\/original\.[^/]+$/, "");
  const webKey = `${base}/web.webp`;
  const thumbKey = `${base}/thumb.webp`;
  const exifKey = `${base}/metadata.exif`;

  try {
    const original = await getObjectBytes(photo.originalKey);
    const { web, thumb, exif, width, height } = await processImage(original);

    await putObject(webKey, web, "image/webp");
    await putObject(thumbKey, thumb, "image/webp");
    if (exif) {
      await putObject(exifKey, exif, "application/json");
    }

    const updated = await prisma.photo.update({
      where: { id: photo.id },
      data: {
        status: "READY",
        webKey,
        thumbKey,
        exifKey: exif ? exifKey : null,
        width,
        height,
      },
    });

    return NextResponse.json({ status: updated.status, webUrl: publicUrl(webKey) });
  } catch {
    await prisma.photo.update({ where: { id: photo.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
