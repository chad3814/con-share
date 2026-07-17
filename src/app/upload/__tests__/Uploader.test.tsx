import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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
