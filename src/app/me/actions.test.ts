import {
  updatePhotoAction,
  setPublishedAction,
  deletePhotoAction,
  updateDisplayNameAction,
} from "./actions";
import { AuthError, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { setPhotoTags } from "@/lib/tags";
import { deleteObjects } from "@/lib/s3";
import type { Photo } from "@/generated/prisma/client";

// `@/lib/auth-helpers` re-exports from `@/auth`, which transitively imports
// `next-auth` and pulls in provider setup that doesn't resolve under Vitest.
// `@/lib/prisma` eagerly constructs a `PrismaClient` on import, which
// requires DATABASE_URL/etc to be set. We therefore mock both fully (no
// `vi.importActual`), along with the other DB/S3-backed collaborators, so
// this file exercises only the ownership-gating logic in `./actions`.
vi.mock("@/lib/auth-helpers", () => ({
  requireUser: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@/lib/authz", () => ({
  isAdmin: vi.fn((user: { role: string } | null | undefined) => user?.role === "ADMIN"),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/tags", () => ({
  setPhotoTags: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  deleteObjects: vi.fn(),
  photoKeysFromOriginal: vi.fn((originalKey: string) => {
    const match = originalKey.match(/^(.*)\/original\.[^/]+$/);
    if (!match) return null;
    const base = match[1];
    return {
      original: originalKey,
      exif: `${base}/metadata.exif`,
      web: `${base}/web.webp`,
      thumb: `${base}/thumb.webp`,
    };
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const OWNER_ID = "owner-1";
const OTHER_ID = "someone-else";

type PhotoWithConvention = Photo & { convention: { slug: string } };

function makePhoto(overrides: Partial<Photo> = {}): PhotoWithConvention {
  return {
    id: "photo-1",
    conventionId: "conv-1",
    uploaderId: OWNER_ID,
    status: "READY",
    originalKey: "conventions/conv-1/photos/photo-1/original.jpg",
    webKey: null,
    thumbKey: null,
    exifKey: null,
    published: false,
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
    convention: { slug: "con-1" },
  };
}

describe("me photo server actions - ownership gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when the caller does not own the photo and is not an admin", () => {
    beforeEach(() => {
      vi.mocked(requireUser).mockResolvedValue({ id: OWNER_ID, role: "USER" });
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(
        makePhoto({ uploaderId: OTHER_ID }),
      );
    });

    it("rejects updatePhotoAction with an AuthError and performs no mutation", async () => {
      const formData = new FormData();
      formData.set("description", "hacked");

      await expect(updatePhotoAction("photo-1", formData)).rejects.toBeInstanceOf(AuthError);

      expect(prisma.photo.update).not.toHaveBeenCalled();
      expect(setPhotoTags).not.toHaveBeenCalled();
    });

    it("rejects setPublishedAction with an AuthError and performs no mutation", async () => {
      await expect(setPublishedAction("photo-1", true)).rejects.toBeInstanceOf(AuthError);

      expect(prisma.photo.update).not.toHaveBeenCalled();
    });

    it("rejects deletePhotoAction with an AuthError and performs no S3 delete or DB delete", async () => {
      await expect(deletePhotoAction("photo-1")).rejects.toBeInstanceOf(AuthError);

      expect(deleteObjects).not.toHaveBeenCalled();
      expect(prisma.photo.delete).not.toHaveBeenCalled();
    });
  });

  describe("when the caller owns the photo", () => {
    beforeEach(() => {
      vi.mocked(requireUser).mockResolvedValue({ id: OWNER_ID, role: "USER" });
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(
        makePhoto({ uploaderId: OWNER_ID, status: "READY" }),
      );
    });

    it("updates the photo and its tags", async () => {
      const formData = new FormData();
      formData.set("description", "a great photo");
      formData.set("photographerCredit", "Jane Doe");
      formData.set("tags", "con,cosplay");

      await updatePhotoAction("photo-1", formData);

      expect(prisma.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "photo-1" } }),
      );
      expect(setPhotoTags).toHaveBeenCalledWith("photo-1", ["con", "cosplay"]);
    });

    it("publishes a READY photo", async () => {
      await setPublishedAction("photo-1", true);

      expect(prisma.photo.update).toHaveBeenCalledWith({
        where: { id: "photo-1" },
        data: { published: true },
      });
    });

    it("deletes S3 objects then the DB row, in that order", async () => {
      await deletePhotoAction("photo-1");

      expect(deleteObjects).toHaveBeenCalledTimes(1);
      const keys = vi.mocked(deleteObjects).mock.calls[0][0];
      expect(keys).toHaveLength(4);
      expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: "photo-1" } });

      const s3CallOrder = vi.mocked(deleteObjects).mock.invocationCallOrder[0];
      const dbCallOrder = vi.mocked(prisma.photo.delete).mock.invocationCallOrder[0];
      expect(s3CallOrder).toBeLessThan(dbCallOrder);
    });
  });

  describe("publish guard", () => {
    it("rejects publishing a non-READY photo and does not update", async () => {
      vi.mocked(requireUser).mockResolvedValue({ id: OWNER_ID, role: "USER" });
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(
        makePhoto({ uploaderId: OWNER_ID, status: "PENDING" }),
      );

      await expect(setPublishedAction("photo-1", true)).rejects.toThrow();

      expect(prisma.photo.update).not.toHaveBeenCalled();
    });
  });

  describe("admin override", () => {
    it("allows an admin to update another user's photo", async () => {
      vi.mocked(requireUser).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(
        makePhoto({ uploaderId: OTHER_ID, status: "READY" }),
      );

      const formData = new FormData();
      formData.set("description", "admin edit");

      await updatePhotoAction("photo-1", formData);

      expect(prisma.photo.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "photo-1" } }),
      );
    });

    it("allows an admin to publish another user's photo", async () => {
      vi.mocked(requireUser).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(
        makePhoto({ uploaderId: OTHER_ID, status: "READY" }),
      );

      await setPublishedAction("photo-1", true);

      expect(prisma.photo.update).toHaveBeenCalledWith({
        where: { id: "photo-1" },
        data: { published: true },
      });
    });

    it("allows an admin to delete another user's photo", async () => {
      vi.mocked(requireUser).mockResolvedValue({ id: "admin-1", role: "ADMIN" });
      vi.mocked(prisma.photo.findUnique).mockResolvedValue(
        makePhoto({ uploaderId: OTHER_ID, status: "READY" }),
      );

      await deletePhotoAction("photo-1");

      expect(deleteObjects).toHaveBeenCalledTimes(1);
      expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: "photo-1" } });
    });
  });

  describe("updateDisplayNameAction", () => {
    it("rejects an empty display name", async () => {
      vi.mocked(requireUser).mockResolvedValue({ id: OWNER_ID, role: "USER" });
      const formData = new FormData();
      formData.set("displayName", "   ");

      await expect(updateDisplayNameAction(formData)).rejects.toThrow();

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("updates the display name for the session user", async () => {
      vi.mocked(requireUser).mockResolvedValue({ id: OWNER_ID, role: "USER" });
      const formData = new FormData();
      formData.set("displayName", "  Jane Doe  ");

      await updateDisplayNameAction(formData);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: OWNER_ID },
        data: { displayName: "Jane Doe" },
      });
    });
  });
});
