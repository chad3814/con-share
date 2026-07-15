import { z } from "zod";

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_BATCH = 25;

export const presignRequestSchema = z.object({
  conventionId: z.string().min(1),
  files: z
    .array(
      z.object({
        contentType: z.enum(ACCEPTED_TYPES),
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      }),
    )
    .min(1)
    .max(MAX_BATCH),
});

export type PresignRequest = z.infer<typeof presignRequestSchema>;

export function parsePresignRequest(raw: object): PresignRequest {
  return presignRequestSchema.parse(raw);
}
