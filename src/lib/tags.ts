import type { Prisma } from "@/generated/prisma/client";

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

// Thin DB helpers (no unit test — per the plan's testing strategy).
// `@/lib/prisma` is imported lazily (dynamic import) rather than at module
// top-level: that module eagerly constructs a `PrismaClient` on import,
// which requires DATABASE_URL/AUTH_*/S3_* env vars to be set. A static
// top-level import would make importing this file for the pure-function
// unit tests above crash during module evaluation in the test environment
// (no env vars configured there). Deferring the import means the prisma
// client is only constructed when one of these DB-backed functions is
// actually invoked, keeping behavior identical for real callers.
export async function setPhotoTags(photoId: string, names: string[]): Promise<void> {
  const normalized = normalizeTagList(names);
  const { prisma } = await import("@/lib/prisma");
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tagIds: string[] = [];
    for (const name of normalized) {
      const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
      tagIds.push(tag.id);
    }
    await tx.photoTag.deleteMany({ where: { photoId } });
    if (tagIds.length > 0) {
      await tx.photoTag.createMany({ data: tagIds.map((tagId) => ({ photoId, tagId })) });
    }
  });
}

export async function photoTagNames(photoId: string): Promise<string[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.photoTag.findMany({
    where: { photoId },
    include: { tag: true },
    orderBy: { tag: { name: "asc" } },
  });
  return rows.map((row) => row.tag.name);
}

export async function searchTags(prefix: string, limit = 10): Promise<string[]> {
  const normalized = normalizeTagName(prefix);
  if (normalized.length === 0) return [];
  const { prisma } = await import("@/lib/prisma");
  const tags = await prisma.tag.findMany({
    where: { name: { startsWith: normalized } },
    orderBy: { name: "asc" },
    take: limit,
  });
  return tags.map((tag) => tag.name);
}
