import { parseReportInput } from "@/lib/validation/report";

describe("parseReportInput", () => {
  it("parses a minimal valid input", () => {
    expect(parseReportInput({ category: "ABUSE" })).toEqual({
      category: "ABUSE",
      message: undefined,
      contactEmail: undefined,
    });
  });

  it("trims message and treats empty string as undefined", () => {
    expect(
      parseReportInput({ category: "OTHER", message: "  hello world  " }),
    ).toEqual({
      category: "OTHER",
      message: "hello world",
      contactEmail: undefined,
    });
    expect(
      parseReportInput({ category: "OTHER", message: "   " }).message,
    ).toBeUndefined();
  });

  it("throws for an invalid category", () => {
    expect(() => parseReportInput({ category: "BOGUS" })).toThrow();
  });

  it("throws for an invalid contact email", () => {
    expect(() =>
      parseReportInput({ category: "ABUSE", contactEmail: "notanemail" }),
    ).toThrow();
  });

  it("accepts a valid contact email", () => {
    expect(
      parseReportInput({ category: "ABUSE", contactEmail: "a@b.com" })
        .contactEmail,
    ).toBe("a@b.com");
  });

  it("throws when message exceeds 2000 characters", () => {
    expect(() =>
      parseReportInput({ category: "ABUSE", message: "a".repeat(2001) }),
    ).toThrow();
  });
});
