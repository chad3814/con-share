// Pure tag-name helpers with no server-only dependencies (no Prisma import,
// even dynamic), so this module is safe to import from client components
// (e.g. `TagInput`). `@/lib/tags` re-exports these for server callers.

const MAX_TAGS = 20;

export function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeTagList(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const name = normalizeTagName(item);
    if (name.length === 0 || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}
