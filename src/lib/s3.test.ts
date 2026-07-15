import { vi } from "vitest";

// The module under test constructs `S3Client` at module scope, which reads
// `env.S3_REGION` immediately on import. That triggers full env-schema
// validation (all required vars, not just the S3 ones) via the lazy `env`
// proxy in `@/env`. `vi.hoisted` runs before the static imports below are
// evaluated, so we stub dummy values here to keep these pure-builder tests
// deterministic without real secrets.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/db";
  process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/db";
  process.env.AUTH_SECRET ??= "test-auth-secret-with-enough-length";
  process.env.AUTH_GITHUB_ID ??= "test-github-id";
  process.env.AUTH_GITHUB_SECRET ??= "test-github-secret";
  process.env.AUTH_GOOGLE_ID ??= "test-google-id";
  process.env.AUTH_GOOGLE_SECRET ??= "test-google-secret";
  process.env.S3_BUCKET ??= "test-bucket";
  process.env.S3_REGION ??= "us-test-1";
  process.env.S3_ACCESS_KEY_ID ??= "test-access-key-id";
  process.env.S3_SECRET_ACCESS_KEY ??= "test-secret-access-key";
});

import { photoKeys, extForContentType, publicUrl } from "@/lib/s3";

describe("photoKeys", () => {
  it("builds the four keys under the convention/photo prefix", () => {
    const k = photoKeys("con1", "ph1", "jpg");
    expect(k.original).toBe("conventions/con1/photos/ph1/original.jpg");
    expect(k.exif).toBe("conventions/con1/photos/ph1/metadata.exif");
    expect(k.web).toBe("conventions/con1/photos/ph1/web.webp");
    expect(k.thumb).toBe("conventions/con1/photos/ph1/thumb.webp");
  });
});

describe("extForContentType", () => {
  it("maps accepted content types", () => {
    expect(extForContentType("image/jpeg")).toBe("jpg");
    expect(extForContentType("image/heic")).toBe("heic");
  });
  it("throws on unsupported types", () => {
    expect(() => extForContentType("image/gif")).toThrow();
  });
});

describe("publicUrl", () => {
  it("builds a virtual-hosted-style URL", () => {
    expect(publicUrl("conventions/c/photos/p/web.webp")).toMatch(
      /^https:\/\/.+\.s3\..+\.amazonaws\.com\/conventions\/c\/photos\/p\/web\.webp$/,
    );
  });
});
