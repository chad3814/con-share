import {
  parsePresignRequest,
  MAX_UPLOAD_BYTES,
  MAX_BATCH,
} from "@/lib/validation/upload";

describe("parsePresignRequest", () => {
  it("accepts a valid single-file request", () => {
    const result = parsePresignRequest({
      conventionId: "con_1",
      files: [{ contentType: "image/jpeg", size: 1024 }],
    });
    expect(result.conventionId).toBe("con_1");
    expect(result.files).toHaveLength(1);
  });

  it("accepts a valid multi-file request", () => {
    const result = parsePresignRequest({
      conventionId: "con_1",
      files: [
        { contentType: "image/jpeg", size: 1024 },
        { contentType: "image/heic", size: 2048 },
      ],
    });
    expect(result.files).toHaveLength(2);
  });

  it("throws on unsupported contentType", () => {
    expect(() =>
      parsePresignRequest({
        conventionId: "con_1",
        files: [{ contentType: "image/gif", size: 1024 }],
      }),
    ).toThrow();
  });

  it("throws when size exceeds MAX_UPLOAD_BYTES", () => {
    expect(() =>
      parsePresignRequest({
        conventionId: "con_1",
        files: [{ contentType: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 }],
      }),
    ).toThrow();
  });

  it("throws when size is 0", () => {
    expect(() =>
      parsePresignRequest({
        conventionId: "con_1",
        files: [{ contentType: "image/jpeg", size: 0 }],
      }),
    ).toThrow();
  });

  it("throws on empty files array", () => {
    expect(() =>
      parsePresignRequest({ conventionId: "con_1", files: [] }),
    ).toThrow();
  });

  it("throws when more than MAX_BATCH files are provided", () => {
    const files = Array.from({ length: MAX_BATCH + 1 }, () => ({
      contentType: "image/jpeg",
      size: 1024,
    }));
    expect(() =>
      parsePresignRequest({ conventionId: "con_1", files }),
    ).toThrow();
  });

  it("throws when conventionId is missing", () => {
    expect(() =>
      parsePresignRequest({
        files: [{ contentType: "image/jpeg", size: 1024 }],
      }),
    ).toThrow();
  });
});
