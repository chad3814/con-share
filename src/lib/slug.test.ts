import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("LitRPG Con 2026")).toBe("litrpg-con-2026");
  });
  it("collapses runs of non-alphanumerics and trims", () => {
    expect(slugify("  Foo -- Bar!! ")).toBe("foo-bar");
  });
  it("returns empty string for all-symbol input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when unused", async () => {
    const result = await uniqueSlug("con", async () => false);
    expect(result).toBe("con");
  });
  it("suffixes until free", async () => {
    const taken = new Set(["con", "con-2"]);
    const result = await uniqueSlug("con", async (s) => taken.has(s));
    expect(result).toBe("con-3");
  });
});
