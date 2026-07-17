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
  it("accepts a valid url", () => {
    const result = parseConventionInput({ name: "Con", url: "https://example.com" });
    expect(result.url).toBe("https://example.com");
  });
  it("treats an empty url as undefined", () => {
    const result = parseConventionInput({ name: "Con", url: "" });
    expect(result.url).toBeUndefined();
  });
  it("throws on an invalid url", () => {
    expect(() => parseConventionInput({ name: "Con", url: "notaurl" })).toThrow();
  });
  it("rejects a javascript: scheme url", () => {
    expect(() =>
      parseConventionInput({ name: "Con", url: "javascript:alert(1)" }),
    ).toThrow();
  });
  it("rejects a data: scheme url", () => {
    expect(() =>
      parseConventionInput({ name: "Con", url: "data:text/html,<script>alert(1)</script>" }),
    ).toThrow();
  });
});
