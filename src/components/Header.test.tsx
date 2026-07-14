import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: () => Promise.resolve(null),
}));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

import Header from "@/components/Header";

describe("Header", () => {
  it("shows a Sign in link when logged out", async () => {
    render(await Header());
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });
});
