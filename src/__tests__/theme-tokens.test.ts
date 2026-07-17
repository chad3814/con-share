import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--primary",
  "--primary-foreground",
  "--accent",
  "--accent-foreground",
  "--ring",
  "--destructive",
  "--destructive-foreground",
  "--destructive-muted",
  "--destructive-muted-foreground",
];

const SELECTORS = [
  ":root",
  '[data-theme="light"]',
  '[data-theme="dark"]',
  '[data-theme="indigo"]',
  '[data-theme="teal"]',
  '[data-theme="amber"]',
];

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function blockFor(selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) return "";
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function tokenMap(selector: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const decl of blockFor(selector).split(";")) {
    const [rawName, ...rest] = decl.split(":");
    const name = rawName.trim();
    if (name.startsWith("--")) {
      map[name] = rest.join(":").trim();
    }
  }
  return map;
}

describe("theme token completeness", () => {
  for (const selector of SELECTORS) {
    it(`${selector} defines every semantic token`, () => {
      const block = blockFor(selector);
      expect(block, `missing block for ${selector}`).not.toBe("");
      for (const token of TOKENS) {
        expect(block).toContain(`${token}:`);
      }
    });
  }

  it(':root matches [data-theme="light"] token-for-token (no-JS fallback parity)', () => {
    expect(tokenMap(":root")).toEqual(tokenMap('[data-theme="light"]'));
  });
});
