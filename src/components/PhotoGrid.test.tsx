import { render, screen } from "@testing-library/react";
import PhotoGrid from "@/components/PhotoGrid";

describe("PhotoGrid", () => {
  it("shows an empty state when there are no photos", () => {
    render(<PhotoGrid photos={[]} />);
    expect(screen.getByText("No photos have been shared yet.")).toBeInTheDocument();
  });
});
