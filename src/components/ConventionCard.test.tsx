import { render, screen } from "@testing-library/react";
import ConventionCard from "@/components/ConventionCard";
import type { ConventionListItem } from "@/lib/conventions";

vi.mock("@/lib/s3", () => ({
  publicUrl: vi.fn((key: string) => `https://bucket.s3.example.com/${key}`),
}));

const base: ConventionListItem = {
  id: "c1",
  slug: "litrpg-con",
  name: "LitRPG Con",
  description: null,
  location: "Denver, CO",
  startDate: new Date("2026-07-01T00:00:00Z"),
  endDate: null,
  bannerKey: null,
  logoKey: null,
  url: null,
  createdById: "u1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  publishedPhotoCount: 1,
};

describe("ConventionCard", () => {
  it("renders name, location, and singular photo count linking to the gallery", () => {
    render(<ConventionCard convention={base} />);
    expect(screen.getByText("LitRPG Con")).toBeInTheDocument();
    expect(screen.getByText("Denver, CO")).toBeInTheDocument();
    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/c/litrpg-con");
  });

  it("shows the letter placeholder when no logo is set", () => {
    render(<ConventionCard convention={base} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("renders the logo image instead of the letter placeholder when logoKey is set", () => {
    const convention = { ...base, logoKey: "conventions/c1/logo.webp" };
    render(<ConventionCard convention={convention} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", expect.stringContaining("conventions/c1/logo.webp"));
    expect(screen.queryByText("L")).not.toBeInTheDocument();
  });

  it("does not render a website link when url is not set", () => {
    render(<ConventionCard convention={base} />);
    expect(screen.queryByRole("link", { name: /website/i })).not.toBeInTheDocument();
  });

  it("renders an external website link when url is set", () => {
    const convention = { ...base, url: "https://example.com" };
    render(<ConventionCard convention={convention} />);
    const websiteLink = screen.getByRole("link", { name: /website/i });
    expect(websiteLink).toHaveAttribute("href", "https://example.com");
    expect(websiteLink).toHaveAttribute("target", "_blank");
    expect(websiteLink.getAttribute("rel")).toContain("noopener");
  });
});
