import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

const validEnv: Record<string, string> = {
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
};

let originalEnv: NodeJS.ProcessEnv;

function clearRequiredEnv(): void {
  for (const key of REQUIRED_KEYS) {
    delete process.env[key];
  }
}

function setValidEnv(): void {
  Object.assign(process.env, validEnv);
}

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("env proxy (lazy validation)", () => {
  it("does not throw on import when required env vars are absent", async () => {
    clearRequiredEnv();
    vi.resetModules();

    await expect(import("@/env")).resolves.not.toThrow();
  });

  it("throws on first property access when required env vars are missing", async () => {
    clearRequiredEnv();
    vi.resetModules();

    const { env } = await import("@/env");

    expect(() => env.DATABASE_URL).toThrow();
  });

  it("returns the expected value when process.env is valid", async () => {
    clearRequiredEnv();
    setValidEnv();
    vi.resetModules();

    const { env } = await import("@/env");

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it("caches the validated result after first access instead of re-parsing", async () => {
    clearRequiredEnv();
    setValidEnv();
    vi.resetModules();

    const { env } = await import("@/env");

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);

    // Mutate process.env after the first successful access. If validation
    // were re-run on every access, this would either throw (invalid URL)
    // or return the mutated value. The cached value must win.
    process.env.DATABASE_URL = "not-a-url";

    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });
});
