import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { parsePresignRequest, MAX_UPLOAD_BYTES } from "@/lib/validation/upload";
import { photoKeys, extForContentType, presignPut } from "@/lib/s3";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { conventionId, files } = parsePresignRequest(body);

    const convention = await prisma.convention.findUnique({
      where: { id: conventionId },
      select: { id: true },
    });
    if (!convention) {
      return NextResponse.json({ error: "Convention not found" }, { status: 404 });
    }

    const uploads = [];
    for (const file of files) {
      const ext = extForContentType(file.contentType);
      const photo = await prisma.photo.create({
        data: {
          conventionId,
          uploaderId: user.id,
          status: "PENDING",
          originalKey: "", // set below once we know the id
          contentType: file.contentType,
        },
      });
      const keys = photoKeys(conventionId, photo.id, ext);
      await prisma.photo.update({ where: { id: photo.id }, data: { originalKey: keys.original } });
      const url = await presignPut(keys.original, file.contentType, MAX_UPLOAD_BYTES);
      uploads.push({ photoId: photo.id, key: keys.original, url });
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    throw error;
  }
}
