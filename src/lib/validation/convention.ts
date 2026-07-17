import { z } from "zod";

const emptyToUndefined = (v: FormDataEntryValue | null | undefined) =>
  typeof v === "string" && v.trim() === "" ? undefined : v ?? undefined;

const optionalTrimmed = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());

export const conventionInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: optionalTrimmed,
  location: optionalTrimmed,
  startDate: optionalDate,
  endDate: optionalDate,
  // Restrict to http/https so a stored url can't smuggle a `javascript:` or
  // `data:` scheme into an <a href> rendered on public pages.
  url: z.preprocess(emptyToUndefined, z.url({ protocol: /^https?$/ }).optional()),
});

export type ConventionInput = z.infer<typeof conventionInputSchema>;

export function parseConventionInput(
  raw: Record<string, FormDataEntryValue | null | undefined>,
): ConventionInput {
  return conventionInputSchema.parse(raw);
}
