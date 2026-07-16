import { extractPhotoId } from "@/lib/dmca";

describe("extractPhotoId", () => {
  it("extracts the id from a full single-photo URL", () => {
    expect(extractPhotoId("https://host/c/litrpg/p/abc123")).toBe("abc123");
  });

  it("accepts a bare id", () => {
    expect(extractPhotoId("abc123")).toBe("abc123");
  });

  it("extracts the id from a URL with a query string", () => {
    expect(extractPhotoId("https://host/c/litrpg/p/xyz?foo=1")).toBe("xyz");
  });

  it("returns null for an empty string", () => {
    expect(extractPhotoId("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(extractPhotoId("   ")).toBeNull();
  });

  it("returns null for an unrelated URL with no /p/ segment", () => {
    expect(extractPhotoId("https://host/c/litrpg")).toBeNull();
  });
});
