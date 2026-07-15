"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseConventionInput } from "@/lib/validation/convention";
import { createConvention, updateConvention } from "@/lib/conventions";

export async function createConventionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const input = parseConventionInput(Object.fromEntries(formData));
  await createConvention(input, admin.id);
  revalidatePath("/admin/conventions");
  revalidatePath("/");
  redirect("/admin/conventions");
}

export async function updateConventionAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const input = parseConventionInput(Object.fromEntries(formData));
  await updateConvention(id, input);
  revalidatePath("/admin/conventions");
  revalidatePath("/");
  redirect("/admin/conventions");
}
