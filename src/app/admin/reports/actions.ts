"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/s3";

function optionalText(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function takedownPhotoAction(photoId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const reason = optionalText(formData.get("reason"));
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { convention: { select: { slug: true } } },
  });
  if (!photo) throw new Error("Photo not found");

  // Soft-remove: flip status, resolve open reports, write audit — BEFORE touching S3.
  // These writes must be atomic for audit-trail integrity.
  await prisma.$transaction([
    prisma.photo.update({
      where: { id: photo.id },
      data: { status: "TAKEN_DOWN", takenDownAt: new Date(), takenDownById: admin.id, takedownReason: reason },
    }),
    prisma.report.updateMany({
      where: { photoId: photo.id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedById: admin.id, resolvedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { actorId: admin.id, photoId: photo.id, action: "takedown", reason },
    }),
  ]);

  // Delete ONLY the public derivatives; RETAIN the private original + .exif.
  // The DB takedown above is authoritative (gallery/single-photo already hide
  // this photo), so a failed derivative delete is best-effort cleanup, not a
  // correctness failure — revalidation must still run.
  const base = photo.originalKey.replace(/\/original\.[^/]+$/, "");
  try {
    await deleteObjects([`${base}/web.webp`, `${base}/thumb.webp`]);
  } catch (error) {
    console.error("takedown: failed to delete public derivatives", { photoId: photo.id, error });
  }

  revalidatePath("/admin/reports");
  revalidatePath("/me");
  revalidatePath(`/c/${photo.convention.slug}`);
}

export async function dismissReportAction(reportId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const note = optionalText(formData.get("note"));
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  await prisma.report.update({
    where: { id: report.id },
    data: { status: "DISMISSED", resolvedById: admin.id, resolvedAt: new Date(), resolutionNote: note },
  });
  await prisma.auditLog.create({
    data: { actorId: admin.id, photoId: report.photoId, action: "dismiss_report", reason: note },
  });
  revalidatePath("/admin/reports");
}
