import { z } from "zod";

const emptyToUndefined = (v: FormDataEntryValue | null | undefined) =>
  typeof v === "string" && v.trim() === "" ? undefined : v ?? undefined;

export const reportInputSchema = z.object({
  category: z.enum(["ABUSE", "COPYRIGHT", "OTHER"]),
  message: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(2000).optional(),
  ),
  contactEmail: z.preprocess(
    emptyToUndefined,
    z.email().optional(),
  ),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

export function parseReportInput(
  raw: Record<string, FormDataEntryValue | null | undefined>,
): ReportInput {
  return reportInputSchema.parse(raw);
}
