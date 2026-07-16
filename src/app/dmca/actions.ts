"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createReport } from "@/lib/reports";
import { extractPhotoId } from "@/lib/dmca";

const toStringField = (v: FormDataEntryValue | null) =>
  typeof v === "string" ? v : "";

const dmcaInputSchema = z.object({
  photoUrl: z.preprocess(
    toStringField,
    z.string().trim().min(1, "Please provide the photo's URL."),
  ),
  complainantName: z.preprocess(
    toStringField,
    z.string().trim().min(1, "Please provide your name."),
  ),
  contactEmail: z.preprocess(
    (v: FormDataEntryValue | null) => toStringField(v).trim(),
    z.email("Please provide a valid email address."),
  ),
  claim: z.preprocess(
    toStringField,
    z.string().trim().min(1, "Please describe your copyright claim."),
  ),
  agreed: z.literal(true, {
    error: "You must confirm this notice is accurate.",
  }),
});

export type DmcaActionResult = { ok: boolean; error?: string };

export async function submitDmcaAction(
  formData: FormData,
): Promise<DmcaActionResult> {
  const parsed = dmcaInputSchema.safeParse({
    photoUrl: formData.get("photoUrl"),
    complainantName: formData.get("complainantName"),
    contactEmail: formData.get("contactEmail"),
    claim: formData.get("claim"),
    agreed: formData.get("agreed") !== null,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return { ok: false, error: firstIssue?.message ?? "Invalid submission." };
  }

  const { photoUrl, complainantName, contactEmail, claim } = parsed.data;

  const photoId = extractPhotoId(photoUrl);
  if (!photoId) {
    return { ok: false, error: "Could not identify the photo from that URL." };
  }

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true },
  });
  if (!photo) {
    return { ok: false, error: "Photo not found." };
  }

  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")) ?? undefined;

  await createReport(
    photoId,
    {
      category: "COPYRIGHT",
      message: `DMCA from ${complainantName}: ${claim}`,
      contactEmail,
    },
    { ip },
  );

  return { ok: true };
}
