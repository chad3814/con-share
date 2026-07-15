import { requireAdmin } from "@/lib/auth-helpers";
import { createConvention, updateConvention } from "@/lib/conventions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  });
});
