// Extract a photo id from a con-share single-photo URL (or accept a bare id).
export function extractPhotoId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/\/p\/([^/?#\s]+)/);
  if (match) return match[1];
  // bare id (no slash) — accept as-is
  if (!trimmed.includes("/")) return trimmed;
  return null;
}
