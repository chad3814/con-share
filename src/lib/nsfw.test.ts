import { showNsfwFromCookie } from "@/lib/nsfw";

describe("showNsfwFromCookie", () => {
  it("returns true when the cookie value is \"1\"", () => {
    expect(showNsfwFromCookie("1")).toBe(true);
  });

  it("returns false when the cookie is undefined", () => {
    expect(showNsfwFromCookie(undefined)).toBe(false);
  });

  it("returns false for \"0\"", () => {
    expect(showNsfwFromCookie("0")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(showNsfwFromCookie("")).toBe(false);
  });

  it("returns false for \"true\"", () => {
    expect(showNsfwFromCookie("true")).toBe(false);
  });
});
