"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { parseReportInput } from "@/lib/validation/report";
import { createReport } from "@/lib/reports";

export async function createReportAction(
  photoId: string,
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")) ?? undefined;
  const input = parseReportInput(Object.fromEntries(formData));
  await createReport(photoId, input, { userId: user?.id, ip });
  // Always resolves; never reveal dedupe/rate-limit outcome to the reporter.
}
