"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser, type SessionUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { setPhotoTags } from "@/lib/tags";
import { deleteObjects } from "@/lib/s3";

const photoMetaSchema = z.object({
  description: z.string().trim().max(2000).optional(),
  photographerCredit: z.string().trim().max(200).optional(),
});

async function loadOwnedPhoto(photoId: string, user: SessionUser) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { convention: { select: { slug: true } } },
  });
  if (!photo || (photo.uploaderId !== user.id && !isAdmin(user))) {
    throw new AuthError("Photo not found or not permitted");
  }
  return photo;
}

function optionalText(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function revalidatePhotoPaths(gallerySlug: string): void {
  revalidatePath("/me");
  revalidatePath("/");
  revalidatePath(`/c/${gallerySlug}`);
}

export async function updatePhotoAction(photoId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const photo = await loadOwnedPhoto(photoId, user);
  const parsed = photoMetaSchema.parse({
    description: optionalText(formData.get("description")),
    photographerCredit: optionalText(formData.get("photographerCredit")),
  });
  const description = parsed.description && parsed.description.length > 0 ? parsed.description : null;
  const photographerCredit =
    parsed.photographerCredit && parsed.photographerCredit.length > 0 ? parsed.photographerCredit : null;
  const nsfw = formData.get("nsfw") !== null;
  const tagsRaw = formData.get("tags");
  const tagNames = typeof tagsRaw === "string" ? tagsRaw.split(",") : [];
  await prisma.photo.update({ where: { id: photo.id }, data: { description, photographerCredit, nsfw } });
  await setPhotoTags(photo.id, tagNames);
  revalidatePhotoPaths(photo.convention.slug);
}

export async function setPublishedAction(photoId: string, published: boolean): Promise<void> {
  const user = await requireUser();
  const photo = await loadOwnedPhoto(photoId, user);
  if (published && photo.status !== "READY") {
    throw new Error("Only processed photos can be published");
  }
  await prisma.photo.update({ where: { id: photo.id }, data: { published } });
  revalidatePhotoPaths(photo.convention.slug);
}

export async function deletePhotoAction(photoId: string): Promise<void> {
  const user = await requireUser();
  const photo = await loadOwnedPhoto(photoId, user);
  const base = photo.originalKey.replace(/\/original\.[^/]+$/, "");
  const keys = [photo.originalKey, `${base}/metadata.exif`, `${base}/web.webp`, `${base}/thumb.webp`];
  await deleteObjects(keys);
  await prisma.photo.delete({ where: { id: photo.id } }); // PhotoTag rows cascade
  revalidatePhotoPaths(photo.convention.slug);
}

export async function updateDisplayNameAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const raw = formData.get("displayName");
  const displayName = typeof raw === "string" ? raw.trim() : "";
  if (displayName.length === 0) throw new Error("Display name is required");
  await prisma.user.update({ where: { id: user.id }, data: { displayName } });
  revalidatePath("/me");
}
