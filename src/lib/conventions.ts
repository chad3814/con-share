import { prisma } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { ConventionInput } from "@/lib/validation/convention";
import type { Convention, PhotoStatus } from "@/generated/prisma/client";

const READY_STATUS: PhotoStatus = "READY";
const publishedPhotoWhere = { published: true, status: READY_STATUS };

export type ConventionListItem = Convention & { publishedPhotoCount: number };

export async function listPublicConventions(): Promise<ConventionListItem[]> {
  const conventions = await prisma.convention.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { photos: { where: publishedPhotoWhere } } } },
  });
  return conventions.map(({ _count, ...c }) => ({
    ...c,
    publishedPhotoCount: _count.photos,
  }));
}

export async function getConventionBySlug(
  slug: string,
): Promise<ConventionListItem | null> {
  const convention = await prisma.convention.findUnique({
    where: { slug },
    include: { _count: { select: { photos: { where: publishedPhotoWhere } } } },
  });
  if (!convention) return null;
  const { _count, ...c } = convention;
  return { ...c, publishedPhotoCount: _count.photos };
}

export async function createConvention(
  input: ConventionInput,
  createdById: string,
): Promise<Convention> {
  const base = slugify(input.name) || "convention";
  const slug = await uniqueSlug(base, async (s) => {
    const existing = await prisma.convention.findUnique({ where: { slug: s } });
    return existing !== null;
  });
  return prisma.convention.create({
    data: { ...input, slug, createdById },
  });
}

export async function updateConvention(
  id: string,
  input: ConventionInput,
): Promise<Convention> {
  return prisma.convention.update({ where: { id }, data: { ...input } });
}
