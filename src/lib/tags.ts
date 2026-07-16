import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeTagList, normalizeTagName } from "@/lib/tag-utils";

export { normalizeTagList, normalizeTagName };

// Thin DB helpers (no unit test — per the plan's testing strategy).
export async function setPhotoTags(photoId: string, names: string[]): Promise<void> {
  const normalized = normalizeTagList(names);
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
  const tags = await prisma.tag.findMany({
    where: { name: { startsWith: normalized } },
    orderBy: { name: "asc" },
    take: limit,
  });
  return tags.map((tag) => tag.name);
}
