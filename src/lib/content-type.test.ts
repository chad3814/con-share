import { resolveContentType } from "@/lib/content-type";

describe("resolveContentType", () => {
  it("passes through a non-empty fileType unchanged", () => {
    expect(resolveContentType("image/png", "x.heic")).toBe("image/png");
  });

  it("falls back to .heic extension when fileType is empty", () => {
    expect(resolveContentType("", "photo.heic")).toBe("image/heic");
  });

  it("matches uppercase .HEIC extension case-insensitively", () => {
    expect(resolveContentType("", "PHOTO.HEIC")).toBe("image/heic");
  });

  it("falls back to .heif extension when fileType is empty", () => {
    expect(resolveContentType("", "photo.heif")).toBe("image/heif");
  });

  it("falls back to .jpeg extension when fileType is empty", () => {
    expect(resolveContentType("", "photo.jpeg")).toBe("image/jpeg");
  });

  it("falls back to .jpg extension when fileType is empty", () => {
    expect(resolveContentType("", "photo.jpg")).toBe("image/jpeg");
  });

  it("falls back to .png extension when fileType is empty", () => {
    expect(resolveContentType("", "photo.png")).toBe("image/png");
  });

  it("falls back to .webp extension when fileType is empty", () => {
    expect(resolveContentType("", "photo.webp")).toBe("image/webp");
  });

  it("returns empty string when fileType is empty and name has no dot", () => {
    expect(resolveContentType("", "photo")).toBe("");
  });

  it("returns empty string when fileType is empty and extension is unrecognized", () => {
    expect(resolveContentType("", "photo.gif")).toBe("");
  });
});
