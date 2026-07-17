"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseConventionInput } from "@/lib/validation/convention";
import { createConvention, updateConvention } from "@/lib/conventions";
import { processLogo, ACCEPTED_LOGO_TYPES } from "@/lib/logo";
import { conventionLogoKey, putObject, deleteObjects } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

type LogoIntent = { webp: Buffer | null; remove: boolean };

// Validate the logo type AND decode/resize it up front, before any DB write.
// Doing the sharp work here (rather than after create/update) means a corrupt
// but correctly-typed image fails the action before the convention row is
// mutated, instead of leaving a partially-applied change behind.
async function readLogoIntent(formData: FormData): Promise<LogoIntent> {
  const remove = formData.get("removeLogo") !== null;
  const entry = formData.get("logo");
  const file = entry instanceof File && entry.size > 0 ? entry : null;
  if (!file) {
    return { webp: null, remove };
  }
  if (!(ACCEPTED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Unsupported logo type. Use JPEG, PNG, or WebP.");
  }
  const webp = await processLogo(Buffer.from(await file.arrayBuffer()));
  return { webp, remove };
}

async function applyConventionLogo(conventionId: string, intent: LogoIntent): Promise<void> {
  if (intent.webp) {
    const key = conventionLogoKey(conventionId);
    await putObject(key, intent.webp, "image/webp");
    await prisma.convention.update({ where: { id: conventionId }, data: { logoKey: key } });
  } else if (intent.remove) {
    await deleteObjects([conventionLogoKey(conventionId)]);
    await prisma.convention.update({ where: { id: conventionId }, data: { logoKey: null } });
  }
}

export async function createConventionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const input = parseConventionInput(Object.fromEntries(formData));
  const intent = await readLogoIntent(formData);
  const convention = await createConvention(input, admin.id);
  await applyConventionLogo(convention.id, intent);
  revalidatePath("/admin/conventions");
  revalidatePath("/");
  redirect("/admin/conventions");
}

export async function updateConventionAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const input = parseConventionInput(Object.fromEntries(formData));
  const intent = await readLogoIntent(formData);
  await updateConvention(id, input);
  await applyConventionLogo(id, intent);
  revalidatePath("/admin/conventions");
  revalidatePath("/");
  redirect("/admin/conventions");
}
