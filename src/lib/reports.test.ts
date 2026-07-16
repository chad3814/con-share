import { shouldRejectReport } from "@/lib/reports";

describe("shouldRejectReport", () => {
  it("rejects when the reporter already has an open report (dedupe)", () => {
    expect(shouldRejectReport(true, 0, 10)).toBe(true);
  });

  it("rejects when the per-IP cap has been hit", () => {
    expect(shouldRejectReport(false, 10, 10)).toBe(true);
  });

  it("allows when under the cap and no dedupe hit", () => {
    expect(shouldRejectReport(false, 9, 10)).toBe(false);
  });

  it("allows when there is no existing activity", () => {
    expect(shouldRejectReport(false, 0, 10)).toBe(false);
  });
});
