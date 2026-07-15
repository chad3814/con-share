import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { parsePresignRequest } from "@/lib/validation/upload";
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
    const createdIds: string[] = [];
    try {
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
        createdIds.push(photo.id);
        const keys = photoKeys(conventionId, photo.id, ext);
        await prisma.photo.update({ where: { id: photo.id }, data: { originalKey: keys.original } });
        const url = await presignPut(keys.original, file.contentType, file.size);
        uploads.push({ photoId: photo.id, key: keys.original, url });
      }
    } catch (error) {
      if (createdIds.length > 0) {
        await prisma.photo.deleteMany({ where: { id: { in: createdIds } } });
      }
      throw error;
    }

    return NextResponse.json({ uploads });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    throw error;
  }
}
