# Multi-theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site's hardcoded, non-adaptive colors with a semantic token system driving five selectable themes (Light, Dark, Indigo, Teal, Amber), defaulting to the OS setting with a header dropdown override — fixing the dark-grey-on-black / white-on-white contrast bug.

**Architecture:** Semantic CSS custom properties defined per theme in `globals.css`, mapped to Tailwind v4 utilities via `@theme inline`. Theme selection, persistence, no-flash, and System→light/dark resolution are handled by `next-themes` (`attribute="data-theme"`). Components are migrated from hardcoded `gray/white/black` utilities to the semantic utilities.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, next-themes, Vitest + Testing Library.

## Global Constraints

- TypeScript only; never use the `any` or `unknown` types.
- 2-space indentation; always end statements with semicolons.
- Tailwind CSS v4 (no `tailwind.config`; theme via `@theme inline` in `globals.css`).
- Dependency: `next-themes@^0.4` (App Router + React 19 compatible).
- The 14 semantic tokens (exact names): `--background`, `--foreground`, `--card`, `--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring`, `--destructive`, `--destructive-foreground`.
- The 5 theme selectors (exact): `[data-theme="light"]`, `[data-theme="dark"]`, `[data-theme="indigo"]`, `[data-theme="teal"]`, `[data-theme="amber"]` (light values also live in `:root`).
- All body text must meet WCAG AA (≥4.5:1); large text and focus indicators ≥3:1; borders need 3:1 only when they are the sole indicator of a control (decorative borders/dividers exempt).
- A commit is only allowed after `npm run check` (lint + typecheck + test + build) passes — enforced by the husky pre-commit hook. Never push without explicit approval.

## Migration Mapping (old → new)

Apply this table verbatim wherever the old utility appears. It is deterministic; the only judgement is page-vs-card for `bg-white`.

| Old utility | New utility |
|---|---|
| `bg-white` (page background) | `bg-background` |
| `bg-white` (card/panel/elevated surface) | `bg-card` |
| `bg-white/90` etc. (opacity kept) | `bg-background/90` |
| `text-gray-900`, `text-gray-800`, `text-gray-700` | `text-foreground` |
| `text-gray-600`, `text-gray-500`, `text-gray-400` | `text-muted-foreground` |
| `border-gray-200`, `border-gray-300`, `border-gray-400` | `border-border` |
| `bg-gray-50`, `bg-gray-100` | `bg-muted` |
| `bg-gray-300` (subtle fill) | `bg-muted` |
| `bg-gray-900`, `bg-black` (buttons/primary) | `bg-primary` |
| `text-white` on a primary button/`bg-primary` | `text-primary-foreground` |
| destructive action bg (takedown/DMCA/delete) currently `bg-gray-900`/`bg-black` | `bg-destructive text-destructive-foreground` |
| link that should read branded | add `text-accent` |

When a destructive action is ambiguous, prefer keeping it as `bg-primary` unless the surrounding copy is explicitly a takedown/delete/report submit; use judgement and note it in the commit.

---

## Task 1: Semantic token system + completeness test

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/__tests__/theme-tokens.test.ts`
- Add dependency: `next-themes` (used by later tasks; installed here so lockfile lands once)

**Interfaces:**
- Produces: 14 CSS custom properties per theme mapped to Tailwind color utilities (`bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `text-accent`/`bg-accent`/`text-accent-foreground`, `ring-ring`, `bg-destructive`, `text-destructive-foreground`).

- [ ] **Step 1: Install next-themes**

Run:
```bash
npm install next-themes@^0.4
```
Expected: `next-themes` added to `dependencies` in `package.json`; lockfile updated.

- [ ] **Step 2: Write the failing token-completeness test**

Create `src/__tests__/theme-tokens.test.ts`:
```ts
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
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npm run test -- src/__tests__/theme-tokens.test.ts
```
Expected: FAIL — the `[data-theme=...]` blocks do not yet exist in `globals.css`.

- [ ] **Step 4: Rewrite `globals.css` with the token system**

Replace the entire contents of `src/app/globals.css` with:
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
  --card: #ffffff;
  --card-foreground: #171717;
  --muted: #f5f5f5;
  --muted-foreground: #525252;
  --border: #e5e5e5;
  --primary: #171717;
  --primary-foreground: #fafafa;
  --accent: #4f46e5;
  --accent-foreground: #ffffff;
  --ring: #4f46e5;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
}

[data-theme="light"] {
  --background: #ffffff;
  --foreground: #171717;
  --card: #ffffff;
  --card-foreground: #171717;
  --muted: #f5f5f5;
  --muted-foreground: #525252;
  --border: #e5e5e5;
  --primary: #171717;
  --primary-foreground: #fafafa;
  --accent: #4f46e5;
  --accent-foreground: #ffffff;
  --ring: #4f46e5;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
}

[data-theme="dark"] {
  --background: #0a0a0a;
  --foreground: #ededed;
  --card: #171717;
  --card-foreground: #ededed;
  --muted: #262626;
  --muted-foreground: #a3a3a3;
  --border: #262626;
  --primary: #ededed;
  --primary-foreground: #0a0a0a;
  --accent: #818cf8;
  --accent-foreground: #0a0a0a;
  --ring: #818cf8;
  --destructive: #ef4444;
  --destructive-foreground: #0a0a0a;
}

[data-theme="indigo"] {
  --background: #1e1b2e;
  --foreground: #ede9fe;
  --card: #2a2540;
  --card-foreground: #ede9fe;
  --muted: #3a3357;
  --muted-foreground: #c4b5fd;
  --border: #3f3a5c;
  --primary: #7c3aed;
  --primary-foreground: #ffffff;
  --accent: #a78bfa;
  --accent-foreground: #1e1b2e;
  --ring: #a78bfa;
  --destructive: #f87171;
  --destructive-foreground: #1e1b2e;
}

[data-theme="teal"] {
  --background: #f0fdfa;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --muted: #e6f7f4;
  --muted-foreground: #475569;
  --border: #cbd5e1;
  --primary: #0f766e;
  --primary-foreground: #ffffff;
  --accent: #0f766e;
  --accent-foreground: #ffffff;
  --ring: #0d9488;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
}

[data-theme="amber"] {
  --background: #fffbf5;
  --foreground: #1c1917;
  --card: #fffef9;
  --card-foreground: #1c1917;
  --muted: #f5ede0;
  --muted-foreground: #57534e;
  --border: #ecdfce;
  --primary: #b45309;
  --primary-foreground: #fffbf5;
  --accent: #b45309;
  --accent-foreground: #fffbf5;
  --ring: #d97706;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
}

body {
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npm run test -- src/__tests__/theme-tokens.test.ts
```
Expected: PASS — all 6 selectors define all 14 tokens.

- [ ] **Step 6: Verify build compiles the new CSS**

Run:
```bash
npm run build
```
Expected: `✓ Compiled successfully`. (Utilities like `bg-background` now resolve.)

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/__tests__/theme-tokens.test.ts package.json package-lock.json
git commit -m "feat: add semantic token system for five themes"
```

---

## Task 2: ThemeProvider + layout integration

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `next-themes` (Task 1), semantic utilities (Task 1).
- Produces: `<ThemeProvider>` default export wrapping app; `<html>` carries `data-theme` at runtime; `document`'s `<body>` uses `bg-background text-foreground`.

- [ ] **Step 1: Create the ThemeProvider client wrapper**

Create `src/components/ThemeProvider.tsx`:
```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark", "indigo", "teal", "amber"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: Wire it into the root layout**

Replace the contents of `src/app/layout.tsx` with:
```tsx
import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Con-Share",
  description: "Share photos from your conventions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider>
          <Header />
          <main className="mx-auto w-full max-w-screen-lg px-4 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run the full check**

Run:
```bash
npm run check
```
Expected: lint, typecheck, tests, build all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemeProvider.tsx src/app/layout.tsx
git commit -m "feat: wire next-themes ThemeProvider into root layout"
```

---

## Task 3: ThemeSelect dropdown + Header integration

**Files:**
- Create: `src/components/ThemeSelect.tsx`
- Create: `src/components/__tests__/ThemeSelect.test.tsx`
- Modify: `src/components/Header.tsx`

**Interfaces:**
- Consumes: `useTheme` from `next-themes`; semantic utilities.
- Produces: `<ThemeSelect />` default export (client), rendered by `Header`.

- [ ] **Step 1: Write the failing ThemeSelect tests**

Create `src/components/__tests__/ThemeSelect.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ThemeSelect from "@/components/ThemeSelect";

const setTheme = vi.fn();
let currentTheme = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

describe("ThemeSelect", () => {
  beforeEach(() => {
    setTheme.mockClear();
    currentTheme = "system";
  });

  it("renders all six theme options", () => {
    render(<ThemeSelect />);
    const select = screen.getByLabelText("Theme");
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    expect(options).toEqual([
      "System",
      "Light",
      "Dark",
      "Indigo",
      "Teal",
      "Amber",
    ]);
  });

  it("calls setTheme with the selected value", () => {
    render(<ThemeSelect />);
    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: "indigo" },
    });
    expect(setTheme).toHaveBeenCalledWith("indigo");
  });

  it("reflects the current theme as the selected value", () => {
    currentTheme = "teal";
    render(<ThemeSelect />);
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("teal");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npm run test -- src/components/__tests__/ThemeSelect.test.tsx
```
Expected: FAIL — `ThemeSelect` does not exist yet.

- [ ] **Step 3: Implement ThemeSelect**

Create `src/components/ThemeSelect.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "indigo", label: "Indigo" },
  { value: "teal", label: "Teal" },
  { value: "amber", label: "Amber" },
] as const;

const SELECT_CLASS =
  "rounded border border-border bg-card px-2 py-1 text-sm text-foreground";

export default function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <select aria-label="Theme" disabled className={SELECT_CLASS}>
        <option>System</option>
      </select>
    );
  }

  return (
    <select
      aria-label="Theme"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      className={SELECT_CLASS}
    >
      {THEME_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npm run test -- src/components/__tests__/ThemeSelect.test.tsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Add ThemeSelect to the Header and migrate its colors**

Replace the contents of `src/components/Header.tsx` with:
```tsx
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { signOut } from "@/auth";
import ThemeSelect from "@/components/ThemeSelect";

export default async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Con-Share
        </Link>
        <div className="flex items-center gap-3">
          <ThemeSelect />
          {user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
              className="flex items-center gap-3"
            >
              <span className="text-sm text-muted-foreground">
                {user.name ?? "Signed in"}
              </span>
              <button type="submit" className="text-sm font-medium underline">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-sm font-medium underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Run the full check**

Run:
```bash
npm run check
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ThemeSelect.tsx src/components/__tests__/ThemeSelect.test.tsx src/components/Header.tsx
git commit -m "feat: add theme dropdown to header"
```

---

## Task 4: Migrate shared components

**Files (Modify):**
- `src/components/ConventionCard.tsx`
- `src/components/NsfwToggle.tsx`
- `src/components/PhotoGrid.tsx`
- `src/components/PhotoThumb.tsx`
- `src/components/TagInput.tsx`

**Interfaces:**
- Consumes: semantic utilities (Task 1). No new exports.

- [ ] **Step 1: Apply the Migration Mapping to each file**

For each file listed above, replace every hardcoded `gray/white/black` utility with its semantic equivalent per the Migration Mapping table at the top of this plan. Preserve all opacity suffixes, layout, and non-color classes exactly. Do not change any logic.

Find occurrences per file with:
```bash
grep -nE "(text|bg|border)-(white|black|gray-[0-9]+)" \
  src/components/ConventionCard.tsx \
  src/components/NsfwToggle.tsx \
  src/components/PhotoGrid.tsx \
  src/components/PhotoThumb.tsx \
  src/components/TagInput.tsx
```

- [ ] **Step 2: Verify no hardcoded colors remain in these files**

Run:
```bash
grep -nE "(text|bg|border)-(white|black|gray-[0-9]+)" \
  src/components/ConventionCard.tsx \
  src/components/NsfwToggle.tsx \
  src/components/PhotoGrid.tsx \
  src/components/PhotoThumb.tsx \
  src/components/TagInput.tsx || echo "CLEAN"
```
Expected: `CLEAN`.

- [ ] **Step 3: Run the full check**

Run:
```bash
npm run check
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "refactor: migrate shared components to semantic color tokens"
```

---

## Task 5: Migrate public pages

**Files (Modify):**
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/upload/page.tsx`
- `src/app/upload/Uploader.tsx`
- `src/app/me/page.tsx`
- `src/app/me/MyPhotos.tsx`
- `src/app/dmca/page.tsx`
- `src/app/dmca/DmcaForm.tsx`
- `src/app/c/[slug]/page.tsx`
- `src/app/c/[slug]/p/[photoId]/page.tsx`
- `src/app/c/[slug]/p/[photoId]/PhotoView.tsx`
- `src/app/c/[slug]/p/[photoId]/ReportForm.tsx`

**Interfaces:**
- Consumes: semantic utilities (Task 1). No new exports.

- [ ] **Step 1: Apply the Migration Mapping to each file**

For each file above, replace every hardcoded `gray/white/black` utility per the Migration Mapping table. For `DmcaForm.tsx` and `ReportForm.tsx`, the submit/takedown action buttons are destructive — map their button background to `bg-destructive text-destructive-foreground` (not `bg-primary`). All other buttons use `bg-primary text-primary-foreground`.

Find occurrences with:
```bash
grep -rnE "(text|bg|border)-(white|black|gray-[0-9]+)" \
  src/app/page.tsx src/app/login src/app/upload src/app/me src/app/dmca "src/app/c"
```

- [ ] **Step 2: Verify no hardcoded colors remain in these files**

Run:
```bash
grep -rnE "(text|bg|border)-(white|black|gray-[0-9]+)" \
  src/app/page.tsx src/app/login src/app/upload src/app/me src/app/dmca "src/app/c" \
  || echo "CLEAN"
```
Expected: `CLEAN`.

- [ ] **Step 3: Run the full check**

Run:
```bash
npm run check
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/login src/app/upload src/app/me src/app/dmca "src/app/c"
git commit -m "refactor: migrate public pages to semantic color tokens"
```

---

## Task 6: Migrate admin pages

**Files (Modify):**
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/conventions/page.tsx`
- `src/app/admin/conventions/ConventionForm.tsx`

**Interfaces:**
- Consumes: semantic utilities (Task 1). No new exports.

- [ ] **Step 1: Apply the Migration Mapping to each file**

For each file above, replace every hardcoded `gray/white/black` utility per the Migration Mapping table. In `reports/page.tsx`, the takedown/dismiss action buttons: map takedown to `bg-destructive text-destructive-foreground`; keep dismiss as `bg-primary text-primary-foreground` (or `bg-muted` if it is a secondary/ghost button — match current visual weight).

Find occurrences with:
```bash
grep -rnE "(text|bg|border)-(white|black|gray-[0-9]+)" src/app/admin
```

- [ ] **Step 2: Verify no hardcoded colors remain in admin**

Run:
```bash
grep -rnE "(text|bg|border)-(white|black|gray-[0-9]+)" src/app/admin || echo "CLEAN"
```
Expected: `CLEAN`.

- [ ] **Step 3: Run the full check**

Run:
```bash
npm run check
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin
git commit -m "refactor: migrate admin pages to semantic color tokens"
```

---

## Task 7: Regression guard + final verification

**Files:**
- Create: `src/__tests__/no-hardcoded-colors.test.ts`

**Interfaces:**
- Consumes: the fully migrated codebase (Tasks 3–6).

- [ ] **Step 1: Write the guard test**

Create `src/__tests__/no-hardcoded-colors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const FORBIDDEN = /\b(?:text|bg|border)-(?:white|black|gray-\d{2,3})\b/;

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
  it("has no gray/white/black Tailwind utilities in .tsx files", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (FORBIDDEN.test(readFileSync(file, "utf8"))) {
        offenders.push(file.replace(SRC, "src"));
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard test to verify it passes**

Run:
```bash
npm run test -- src/__tests__/no-hardcoded-colors.test.ts
```
Expected: PASS (all `.tsx` migrated in Tasks 3–6). If it FAILS, it prints the offending files — migrate them per the Migration Mapping and re-run.

- [ ] **Step 3: Run the full check**

Run:
```bash
npm run check
```
Expected: lint, typecheck, all tests, build pass.

- [ ] **Step 4: Manual visual verification**

Run:
```bash
npm run dev
```
Then in a browser at the dev URL:
- Confirm the header shows the Theme dropdown with System / Light / Dark / Indigo / Teal / Amber.
- Switch through all five explicit themes; confirm text is readable on every surface (no dark-grey-on-black, no white-on-white) on the home page, a convention page, a photo page, `/me`, `/upload`, `/login`, `/dmca`, and `/admin`.
- Set the OS to dark, select System, reload; confirm no flash of the wrong theme and that it resolves to Dark.
- Select a theme, reload; confirm the choice persists.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/no-hardcoded-colors.test.ts
git commit -m "test: guard against hardcoded color utilities"
```

---

## Self-Review

**Spec coverage:**
- Token model (spec §1) → Task 1.
- Migration mapping (spec §2) → Migration Mapping table + Tasks 3–6.
- Five themes / palettes (spec §3) → Task 1 `globals.css`.
- Mechanism / next-themes (spec §4) → Tasks 1 (install) + 2 (provider/layout).
- Header dropdown (spec §5) → Task 3.
- Component migration, 24 files (spec §6) → Task 2 (layout), Task 3 (Header), Task 4 (5 shared), Task 5 (12 public), Task 6 (5 admin) = 24. ✓
- Testing (spec §7): ThemeSelect unit tests → Task 3; token-completeness test → Task 1; guard test → Task 7; `npm run check` gate → every task.

**Placeholder scan:** No TBD/TODO; all code shown in full; every command has expected output.

**Type consistency:** `ThemeProvider` and `ThemeSelect` are default exports imported by path in layout/header; `themes` list `["light","dark","indigo","teal","amber"]` matches the `[data-theme=...]` selectors and the token test's `SELECTORS`; the 14 `TOKENS` in the test match the 14 `@theme inline` mappings and every theme block.
