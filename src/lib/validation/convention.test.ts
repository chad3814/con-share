import { parseConventionInput } from "@/lib/validation/convention";

describe("parseConventionInput", () => {
  it("accepts a minimal valid input (name only)", () => {
    const result = parseConventionInput({ name: "LitRPG Con" });
    expect(result.name).toBe("LitRPG Con");
  });
  it("trims name and treats empty optional strings as undefined", () => {
    const result = parseConventionInput({ name: "  Con  ", description: "" });
    expect(result.name).toBe("Con");
    expect(result.description).toBeUndefined();
  });
  it("throws on empty name", () => {
    expect(() => parseConventionInput({ name: "   " })).toThrow();
  });
  it("coerces ISO date strings", () => {
    const result = parseConventionInput({ name: "Con", startDate: "2026-07-01" });
    expect(result.startDate instanceof Date).toBe(true);
  });
});
