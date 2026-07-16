import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ThemeSelect from "@/components/ThemeSelect";

const setTheme = vi.fn();
let currentTheme = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

describe("ThemeSelect", () => {
  beforeEach(() => {
    setTheme.mockClear();
    currentTheme = "system";
  });

  it("renders all six theme options", () => {
    render(<ThemeSelect />);
    const select = screen.getByLabelText("Theme");
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    expect(options).toEqual([
      "System",
      "Light",
      "Dark",
      "Indigo",
      "Teal",
      "Amber",
    ]);
  });

  it("calls setTheme with the selected value", () => {
    render(<ThemeSelect />);
    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: "indigo" },
    });
    expect(setTheme).toHaveBeenCalledWith("indigo");
  });

  it("reflects the current theme as the selected value", () => {
    currentTheme = "teal";
    render(<ThemeSelect />);
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("teal");
  });
});
