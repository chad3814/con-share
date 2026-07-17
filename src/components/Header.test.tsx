import { render, screen } from "@testing-library/react";

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

import Header from "@/components/Header";

describe("Header", () => {
  it("shows a Sign in link when logged out", async () => {
    getCurrentUser.mockResolvedValue(null);
    render(await Header());
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows an Admin link for an admin user", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", name: "Ada", role: "ADMIN" });
    render(await Header());
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("does not show an Admin link for a non-admin user", async () => {
    getCurrentUser.mockResolvedValue({ id: "u2", name: "Bob", role: "USER" });
    render(await Header());
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("links the logged-in user's name to /me", async () => {
    getCurrentUser.mockResolvedValue({ id: "u3", name: "Cleo", role: "USER" });
    render(await Header());
    expect(screen.getByRole("link", { name: "Cleo" })).toHaveAttribute(
      "href",
      "/me",
    );
  });
});
