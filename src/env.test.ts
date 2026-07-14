import { parseEnv } from "@/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@host-pooler.neon.tech/db?sslmode=require",
  DIRECT_URL: "postgresql://u:p@host.neon.tech/db?sslmode=require",
  AUTH_SECRET: "x".repeat(32),
  AUTH_GITHUB_ID: "gh-id",
  AUTH_GITHUB_SECRET: "gh-secret",
  AUTH_GOOGLE_ID: "goog-id",
  AUTH_GOOGLE_SECRET: "goog-secret",
  S3_BUCKET: "con-share",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "ak",
  S3_SECRET_ACCESS_KEY: "sk",
  ADMIN_EMAILS: "chad@cwalker.dev, cwalker@mozilla.com",
};

describe("parseEnv", () => {
  it("parses a valid environment", () => {
    const env = parseEnv(valid);
    expect(env.S3_BUCKET).toBe("con-share");
    expect(env.ADMIN_EMAILS).toBe("chad@cwalker.dev, cwalker@mozilla.com");
  });

  it("throws when a required var is missing", () => {
    const incomplete: Record<string, string | undefined> = { ...valid };
    delete incomplete.AUTH_SECRET;
    expect(() => parseEnv(incomplete)).toThrow();
  });

  it("rejects a non-URL DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrow();
  });
});
