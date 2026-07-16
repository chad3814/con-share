import type { ReportInput } from "@/lib/validation/report";

export const IP_REPORT_CAP = 10;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

// Pure decision — dedupe OR over the per-IP cap.
export function shouldRejectReport(
  hasOpenFromReporter: boolean,
  recentIpCount: number,
  cap: number,
): boolean {
  return hasOpenFromReporter || recentIpCount >= cap;
}

export async function createReport(
  photoId: string,
  input: ReportInput,
  reporter: { userId?: string; ip?: string },
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  // dedupe: an OPEN report already from this reporter (user or ip) for this photo?
  const dedupeFilters = [
    ...(reporter.userId ? [{ reporterUserId: reporter.userId }] : []),
    ...(reporter.ip ? [{ reporterIp: reporter.ip }] : []),
  ];
  const existing =
    dedupeFilters.length > 0
      ? await prisma.report.findFirst({
          where: { photoId, status: "OPEN", OR: dedupeFilters },
        })
      : null;

  const recentIpCount = reporter.ip
    ? await prisma.report.count({
        where: {
          reporterIp: reporter.ip,
          createdAt: { gte: new Date(Date.now() - RATE_WINDOW_MS) },
        },
      })
    : 0;

  if (shouldRejectReport(existing !== null, recentIpCount, IP_REPORT_CAP)) {
    return;
  }

  await prisma.report.create({
    data: {
      photoId,
      reporterUserId: reporter.userId ?? null,
      reporterIp: reporter.ip ?? null,
      category: input.category,
      message: input.message ?? null,
      contactEmail: input.contactEmail ?? null,
    },
  });
}

export async function listOpenReports() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      photo: { include: { convention: { select: { slug: true, name: true } } } },
      reporter: { select: { displayName: true, email: true } },
    },
  });
}
