import { takedownPhotoAction, dismissReportAction } from "./actions";
import { AuthError, requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { deleteObjects } from "@/lib/s3";
import { revalidatePath } from "next/cache";
import type { Photo, Report } from "@/generated/prisma/client";

// `@/lib/auth-helpers` re-exports from `@/auth`, which transitively imports
// `next-auth` and pulls in provider setup that doesn't resolve under Vitest.
// `@/lib/prisma` eagerly constructs a `PrismaClient` on import, which
// requires DATABASE_URL/etc to be set. We therefore mock both fully (no
// `vi.importActual`), along with the other DB/S3-backed collaborators, so
// this file exercises only the admin-gating and key-selection logic in
// `./actions`.
vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    photo: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    report: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/s3", () => ({
  deleteObjects: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

type PhotoWithConvention = Photo & { convention: { slug: string } };

function makePhoto(overrides: Partial<Photo> = {}): PhotoWithConvention {
  return {
    id: "p1",
    conventionId: "c",
    uploaderId: "uploader-1",
    status: "READY",
    originalKey: "conventions/c/photos/p1/original.jpg",
    webKey: null,
    thumbKey: null,
    exifKey: null,
    published: true,
    nsfw: false,
    description: null,
    photographerCredit: null,
    width: null,
    height: null,
    contentType: null,
    takenDownAt: null,
    takenDownById: null,
    takedownReason: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
    convention: { slug: "con" },
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "r1",
    photoId: "p1",
    reporterUserId: null,
    reporterIp: null,
    category: "OTHER",
    message: null,
    contactEmail: null,
    status: "OPEN",
    resolvedById: null,
    resolvedAt: null,
    resolutionNote: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("admin reports server actions - auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Array-form `$transaction` accepts an array of already-built Prisma
    // promises; running them here mirrors what a real transaction does so
    // the individual mutation mocks above are still invoked/observable.
    vi.mocked(prisma.$transaction).mockImplementation(async (arg) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
    );
  });

  describe("when the caller is not an admin", () => {
    beforeEach(() => {
      vi.mocked(requireAdmin).mockRejectedValue(new AuthError("Admin access required"));
    });

    it("rejects takedownPhotoAction and performs no mutation, S3 delete, or audit write", async () => {
      const formData = new FormData();
      formData.set("reason", "nsfw");

      await expect(takedownPhotoAction("p1", formData)).rejects.toBeInstanceOf(AuthError);

      expect(prisma.photo.update).not.toHaveBeenCalled();
      expect(prisma.report.updateMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(deleteObjects).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects dismissReportAction and performs no mutation or audit write", async () => {
      const formData = new FormData();
      formData.set("note", "not a violation");

      await expect(dismissReportAction("r1", formData)).rejects.toBeInstanceOf(AuthError);

      expect(prisma.report.update).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      expect(deleteObjects).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("when the caller is an admin", () => {
    beforeEach(() => {
      vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    });

    it("takes down a photo: flips status, resolves open reports, audits, and deletes ONLY web/thumb", async () => {
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(makePhoto());

      const formData = new FormData();
      formData.set("reason", "copyright violation");

      await takedownPhotoAction("p1", formData);

      expect(prisma.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1" },
          data: expect.objectContaining({
            status: "TAKEN_DOWN",
            takenDownById: "admin-1",
            takedownReason: "copyright violation",
          }),
        }),
      );

      expect(prisma.report.updateMany).toHaveBeenCalledWith({
        where: { photoId: "p1", status: "OPEN" },
        data: expect.objectContaining({ status: "RESOLVED", resolvedById: "admin-1" }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actorId: "admin-1", photoId: "p1", action: "takedown" }),
        }),
      );

      expect(deleteObjects).toHaveBeenCalledTimes(1);
      const keys = vi.mocked(deleteObjects).mock.calls[0][0];
      expect(keys).toEqual([
        "conventions/c/photos/p1/web.webp",
        "conventions/c/photos/p1/thumb.webp",
      ]);
      expect(keys).not.toContain("conventions/c/photos/p1/original.jpg");
      expect(keys).not.toContain("conventions/c/photos/p1/metadata.exif");
    });

    it("resolves and still revalidates when the S3 derivative delete fails (best-effort cleanup)", async () => {
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(makePhoto());
      vi.mocked(deleteObjects).mockRejectedValue(new Error("S3 unavailable"));

      const formData = new FormData();
      formData.set("reason", "nsfw");

      await expect(takedownPhotoAction("p1", formData)).resolves.toBeUndefined();

      expect(prisma.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "TAKEN_DOWN" }) }),
      );
      expect(revalidatePath).toHaveBeenCalledWith("/admin/reports");
      expect(revalidatePath).toHaveBeenCalledWith("/me");
      expect(revalidatePath).toHaveBeenCalledWith("/c/con");
    });

    it("throws when the photo does not exist and performs no mutation or S3 delete", async () => {
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(null);

      await expect(takedownPhotoAction("missing", new FormData())).rejects.toThrow();

      expect(prisma.photo.update).not.toHaveBeenCalled();
      expect(deleteObjects).not.toHaveBeenCalled();
    });

    it("dismisses a report: sets DISMISSED with a resolution note and audits", async () => {
      vi.mocked(prisma.report.findUnique).mockResolvedValue(makeReport());

      const formData = new FormData();
      formData.set("note", "reviewed, no violation found");

      await dismissReportAction("r1", formData);

      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: expect.objectContaining({
          status: "DISMISSED",
          resolvedById: "admin-1",
          resolutionNote: "reviewed, no violation found",
        }),
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actorId: "admin-1", photoId: "p1", action: "dismiss_report" }),
        }),
      );

      expect(deleteObjects).not.toHaveBeenCalled();
    });
  });
});
