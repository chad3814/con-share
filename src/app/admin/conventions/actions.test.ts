import { requireAdmin } from "@/lib/auth-helpers";
import { createConvention, updateConvention } from "@/lib/conventions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { processLogo } from "@/lib/logo";
import { putObject, deleteObjects, conventionLogoKey } from "@/lib/s3";
import { prisma } from "@/lib/prisma";
import type { Convention } from "@/generated/prisma/client";
import { createConventionAction, updateConventionAction } from "./actions";

// `@/lib/auth-helpers` re-exports from `@/auth`, which transitively imports
// `next-auth` and pulls in provider setup that doesn't resolve under Vitest.
// We therefore mock the module fully (no `vi.importActual`) and define a
// local sentinel error class in place of the real `AuthError`, per the
// guidance for auth-gate tests: the important thing is that a rejection from
// `requireAdmin()` propagates before any mutation runs.
class SentinelAuthError extends Error {}

vi.mock("@/lib/auth-helpers", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/conventions", () => ({
  createConvention: vi.fn(),
  updateConvention: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// `@/lib/logo` uses `sharp` for real image processing; `@/lib/s3` eagerly
// constructs an `S3Client` on import, which requires S3 env vars to be set.
// Both are mocked fully so this file exercises only the logo-intent /
// validate-before-mutate logic in `./actions`.
vi.mock("@/lib/logo", () => ({
  processLogo: vi.fn(),
  ACCEPTED_LOGO_TYPES: ["image/jpeg", "image/png", "image/webp"],
}));

vi.mock("@/lib/s3", () => ({
  putObject: vi.fn(),
  deleteObjects: vi.fn(),
  conventionLogoKey: vi.fn((conventionId: string) => `conventions/${conventionId}/logo.webp`),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    convention: {
      update: vi.fn(),
    },
  },
}));

function makeConvention(overrides: Partial<Convention> = {}): Convention {
  return {
    id: "conv-1",
    slug: "litrpg-con",
    name: "LitRPG Con",
    description: null,
    location: null,
    startDate: null,
    endDate: null,
    bannerKey: null,
    logoKey: null,
    url: null,
    createdById: "admin-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("admin convention server actions - auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when the caller is not an admin", () => {
    beforeEach(() => {
      vi.mocked(requireAdmin).mockRejectedValue(
        new SentinelAuthError("Admin access required"),
      );
    });

    it("rejects createConventionAction and never calls createConvention", async () => {
      await expect(
        createConventionAction(new FormData()),
      ).rejects.toThrow(SentinelAuthError);

      expect(createConvention).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("rejects updateConventionAction and never calls updateConvention", async () => {
      await expect(
        updateConventionAction("some-id", new FormData()),
      ).rejects.toThrow(SentinelAuthError);

      expect(updateConvention).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("when the caller is an admin", () => {
    beforeEach(() => {
      vi.mocked(requireAdmin).mockResolvedValue({
        id: "admin-1",
        role: "ADMIN",
      });
      vi.mocked(createConvention).mockResolvedValue(makeConvention());
      vi.mocked(processLogo).mockResolvedValue(Buffer.from("webp-bytes"));
    });

    it("creates a convention using the server-derived admin id, not the form", async () => {
      const formData = new FormData();
      formData.set("name", "LitRPG Con");
      formData.set("createdById", "attacker-supplied-id");

      await createConventionAction(formData);

      expect(createConvention).toHaveBeenCalledTimes(1);
      expect(createConvention).toHaveBeenCalledWith(
        expect.objectContaining({ name: "LitRPG Con" }),
        "admin-1",
      );
      expect(redirect).toHaveBeenCalledWith("/admin/conventions");
    });

    it("updates a convention with the given id and parsed input", async () => {
      const formData = new FormData();
      formData.set("name", "Renamed Con");

      await updateConventionAction("conv-9", formData);

      expect(updateConvention).toHaveBeenCalledTimes(1);
      expect(updateConvention).toHaveBeenCalledWith(
        "conv-9",
        expect.objectContaining({ name: "Renamed Con" }),
      );
      expect(redirect).toHaveBeenCalledWith("/admin/conventions");
    });

    it("processes and stores a valid logo on create", async () => {
      const convention = makeConvention({ id: "conv-42" });
      vi.mocked(createConvention).mockResolvedValue(convention);
      const formData = new FormData();
      formData.set("name", "LitRPG Con");
      formData.set("logo", new File([Buffer.from("x")], "logo.png", { type: "image/png" }));

      await createConventionAction(formData);

      expect(processLogo).toHaveBeenCalledTimes(1);
      expect(putObject).toHaveBeenCalledWith(
        conventionLogoKey("conv-42"),
        Buffer.from("webp-bytes"),
        "image/webp",
      );
      expect(prisma.convention.update).toHaveBeenCalledWith({
        where: { id: "conv-42" },
        data: { logoKey: conventionLogoKey("conv-42") },
      });
      expect(redirect).toHaveBeenCalledWith("/admin/conventions");
    });

    it("removes the logo on update when removeLogo is set and no file is provided", async () => {
      const formData = new FormData();
      formData.set("name", "Renamed Con");
      formData.set("removeLogo", "on");

      await updateConventionAction("conv-9", formData);

      expect(deleteObjects).toHaveBeenCalledWith([conventionLogoKey("conv-9")]);
      expect(prisma.convention.update).toHaveBeenCalledWith({
        where: { id: "conv-9" },
        data: { logoKey: null },
      });
      expect(putObject).not.toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/admin/conventions");
    });

    it("rejects an unsupported logo type before any mutation runs", async () => {
      const formData = new FormData();
      formData.set("name", "LitRPG Con");
      formData.set("logo", new File([Buffer.from("x")], "logo.gif", { type: "image/gif" }));

      await expect(createConventionAction(formData)).rejects.toThrow(
        "Unsupported logo type",
      );

      expect(createConvention).not.toHaveBeenCalled();
      expect(processLogo).not.toHaveBeenCalled();
      expect(putObject).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("rejects an unsupported logo type on update before any mutation runs", async () => {
      const formData = new FormData();
      formData.set("name", "Renamed Con");
      formData.set("logo", new File([Buffer.from("x")], "logo.gif", { type: "image/gif" }));

      await expect(updateConventionAction("conv-9", formData)).rejects.toThrow(
        "Unsupported logo type",
      );

      expect(updateConvention).not.toHaveBeenCalled();
      expect(processLogo).not.toHaveBeenCalled();
      expect(putObject).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
