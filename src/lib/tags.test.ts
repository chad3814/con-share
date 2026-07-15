import { normalizeTagList, normalizeTagName } from "@/lib/tags";

describe("normalizeTagName", () => {
  it("trims and lowercases", () => {
    expect(normalizeTagName("  CosPlay ")).toBe("cosplay");
  });
  it("collapses internal whitespace to a single space", () => {
    expect(normalizeTagName("Multi   Word")).toBe("multi word");
  });
  it("returns empty string for blank input", () => {
    expect(normalizeTagName("   ")).toBe("");
  });
  it("lowercases fully uppercase input", () => {
    expect(normalizeTagName("UPPER")).toBe("upper");
  });
});

describe("normalizeTagList", () => {
  it("dedupes, trims, and lowercases", () => {
    expect(normalizeTagList(["A", "a", " b "])).toEqual(["a", "b"]);
  });
  it("drops empty entries", () => {
    expect(normalizeTagList(["", "  ", "x"])).toEqual(["x"]);
  });
  it("caps at 20 entries", () => {
    const input = Array.from({ length: 25 }, (_, i) => `tag${i}`);
    expect(normalizeTagList(input)).toHaveLength(20);
  });
  it("preserves first-seen order", () => {
    expect(normalizeTagList(["z", "a", "z", "m"])).toEqual(["z", "a", "m"]);
  });
});
