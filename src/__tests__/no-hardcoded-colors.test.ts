import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
// Flag hardcoded palette utilities (white/black + any numbered Tailwind color
// scale). All colors must go through semantic tokens (primary, muted, border,
// destructive, destructive-muted, ...). Extended beyond gray/white/black once
// semantic status tokens replaced the red utilities (issue #1).
const FORBIDDEN =
  /\b(?:text|bg|border|from|via|to|ring|divide|outline)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("no hardcoded color utilities", () => {
  it("has no hardcoded palette Tailwind utilities in .tsx files", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (FORBIDDEN.test(readFileSync(file, "utf8"))) {
        offenders.push(file.replace(SRC, "src"));
      }
    }
    expect(offenders).toEqual([]);
  });
});
