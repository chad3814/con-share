import { render, screen } from "@testing-library/react";
import ConventionCard from "@/components/ConventionCard";
import type { ConventionListItem } from "@/lib/conventions";

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
});
