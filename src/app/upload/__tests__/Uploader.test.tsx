import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Uploader from "@/app/upload/Uploader";

describe("Uploader convention selection", () => {
  it("renders the convention picker in picker mode", () => {
    render(<Uploader conventions={[{ id: "c1", name: "Con One" }]} />);
    expect(screen.queryByRole("combobox")).not.toBeNull();
  });

  it("hides the convention picker in locked mode", () => {
    render(<Uploader fixedConventionId="c1" />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("Uploader drop area", () => {
  it("clicking the drop area opens the hidden file dialog", () => {
    const { container } = render(<Uploader fixedConventionId="c1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /drop photos here/i }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the file input hidden", () => {
    const { container } = render(<Uploader fixedConventionId="c1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.className).toContain("hidden");
  });
});
