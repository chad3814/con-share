import { formatDateRange, toDateInputValue } from "@/lib/date";

describe("formatDateRange", () => {
  it("returns null when start is null", () => {
    expect(formatDateRange(null, null)).toBeNull();
  });

  it("formats a single date when there is no end date", () => {
    const start = new Date("2026-07-01T00:00:00Z");
    expect(formatDateRange(start, null)).toBe("Jul 1, 2026");
  });

  it("formats a start–end range with an en dash", () => {
    const start = new Date("2026-07-01T00:00:00Z");
    const end = new Date("2026-07-04T00:00:00Z");
    expect(formatDateRange(start, end)).toBe("Jul 1, 2026 – Jul 4, 2026");
  });
});

describe("toDateInputValue", () => {
  it("returns an empty string for null", () => {
    expect(toDateInputValue(null)).toBe("");
  });

  it("returns an empty string for undefined", () => {
    expect(toDateInputValue(undefined)).toBe("");
  });

  it("returns a YYYY-MM-DD string for a date", () => {
    expect(toDateInputValue(new Date("2026-07-01T00:00:00Z"))).toBe("2026-07-01");
  });
});
