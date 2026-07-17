import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConventionUploadPanel from "@/components/ConventionUploadPanel";

vi.mock("@/app/upload/Uploader", () => ({
  default: ({ fixedConventionId }: { fixedConventionId?: string }) => (
    <div data-testid="uploader">uploader:{fixedConventionId}</div>
  ),
}));

describe("ConventionUploadPanel", () => {
  it("hides the uploader until the button is clicked", () => {
    render(<ConventionUploadPanel conventionId="c1" conventionName="Con One" />);
    expect(screen.queryByTestId("uploader")).toBeNull();
  });

  it("reveals the uploader (with the fixed convention) on click and hides it again", () => {
    render(<ConventionUploadPanel conventionId="c1" conventionName="Con One" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByTestId("uploader").textContent).toBe("uploader:c1");
    fireEvent.click(button);
    expect(screen.queryByTestId("uploader")).toBeNull();
  });
});
