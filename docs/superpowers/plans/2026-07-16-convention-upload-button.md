# Inline Convention-Upload Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Upload photos" button on the convention gallery page (`/c/[slug]`) for signed-in users that reveals an inline uploader locked to the current convention.

**Architecture:** Add a `fixedConventionId` locked mode to the existing `Uploader` (hides the convention picker). A new client `ConventionUploadPanel` toggles that locked `Uploader` open/closed behind a button. The convention page (a public server component) gates the panel behind `getCurrentUser()`. No API changes — the inline uploader reuses the existing presign/process routes.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 semantic tokens, Vitest + Testing Library.

## Global Constraints

- TypeScript only; never use the `any` or `unknown` types.
- 2-space indentation; always end statements with semicolons.
- Use semantic color tokens only (`bg-primary`, `text-primary-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, etc.) — no hardcoded `gray/white/black`; the `no-hardcoded-colors` guard test enforces this.
- The convention page must stay public (no `requireUser`); only the panel is gated by `getCurrentUser()`.
- The standalone `/upload` page must keep working (picker mode) — `Uploader` used there passes `conventions` and no `fixedConventionId`.
- A commit is only allowed after `npm run check` (lint + typecheck + test + build) passes — enforced by the husky pre-commit hook. Never push without explicit approval.

---

## Task 1: Add locked mode to `Uploader`

**Files:**
- Modify: `src/app/upload/Uploader.tsx` (signature ~line 58, state ~line 59, select block lines 189-202)
- Create: `src/app/upload/__tests__/Uploader.test.tsx`

**Interfaces:**
- Produces: `Uploader` accepts `{ conventions?: ConventionOption[]; fixedConventionId?: string }`. In locked mode (`fixedConventionId` set) the convention `<select>` is not rendered and uploads target `fixedConventionId`. Picker mode (`conventions` provided, no `fixedConventionId`) is unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/app/upload/__tests__/Uploader.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Uploader from "@/app/upload/Uploader";

describe("Uploader convention selection", () => {
  it("renders the convention picker in picker mode", () => {
    render(<Uploader conventions={[{ id: "c1", name: "Con One" }]} />);
    expect(screen.queryByRole("combobox")).not.toBeNull();
  });

  it("hides the convention picker in locked mode", () => {
    render(<Uploader fixedConventionId="c1" />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm run test -- src/app/upload/__tests__/Uploader.test.tsx
```
Expected: FAIL — `Uploader` currently requires `conventions` and always renders the `<select>`; `fixedConventionId` is not a valid prop (type error) and the locked-mode test finds a combobox.

- [ ] **Step 3: Update the `Uploader` signature and state**

In `src/app/upload/Uploader.tsx`, change the component signature (currently
`export default function Uploader({ conventions }: { conventions: ConventionOption[] }) {`)
and the `conventionId` initializer (currently
`const [conventionId, setConventionId] = useState<string>(conventions[0]?.id ?? "");`)
to:
```tsx
export default function Uploader({
  conventions = [],
  fixedConventionId,
}: {
  conventions?: ConventionOption[];
  fixedConventionId?: string;
}) {
  const [conventionId, setConventionId] = useState<string>(
    fixedConventionId ?? conventions[0]?.id ?? "",
  );
```

- [ ] **Step 4: Conditionally render the convention picker**

Wrap the existing convention `<label>` block (lines 189-202) so it only renders in picker mode. Replace:
```tsx
      <label className="block">
        <span className="text-sm font-medium">Convention</span>
        <select
          value={conventionId}
          onChange={(event) => setConventionId(event.target.value)}
          className="mt-1 w-full rounded border border-border px-3 py-2"
        >
          {conventions.map((convention) => (
            <option key={convention.id} value={convention.id}>
              {convention.name}
            </option>
          ))}
        </select>
      </label>
```
with:
```tsx
      {!fixedConventionId ? (
        <label className="block">
          <span className="text-sm font-medium">Convention</span>
          <select
            value={conventionId}
            onChange={(event) => setConventionId(event.target.value)}
            className="mt-1 w-full rounded border border-border px-3 py-2"
          >
            {conventions.map((convention) => (
              <option key={convention.id} value={convention.id}>
                {convention.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npm run test -- src/app/upload/__tests__/Uploader.test.tsx
```
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full check**

Run:
```bash
npm run check
```
Expected: lint, typecheck, all tests, build pass. (Confirms `/upload` still typechecks with the now-optional `conventions` prop.)

- [ ] **Step 7: Commit**

```bash
git add src/app/upload/Uploader.tsx src/app/upload/__tests__/Uploader.test.tsx
git commit -m "feat: add locked convention mode to Uploader"
```

---

## Task 2: `ConventionUploadPanel` component

**Files:**
- Create: `src/components/ConventionUploadPanel.tsx`
- Create: `src/components/__tests__/ConventionUploadPanel.test.tsx`

**Interfaces:**
- Consumes: `Uploader` with `fixedConventionId` (Task 1).
- Produces: `ConventionUploadPanel` default export (client), props `{ conventionId: string; conventionName?: string }`. Renders a toggle button that shows/hides an inline `<Uploader fixedConventionId={conventionId} />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/ConventionUploadPanel.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ConventionUploadPanel from "@/components/ConventionUploadPanel";

vi.mock("@/app/upload/Uploader", () => ({
  default: ({ fixedConventionId }: { fixedConventionId?: string }) => (
    <div data-testid="uploader">uploader:{fixedConventionId}</div>
  ),
}));

describe("ConventionUploadPanel", () => {
  it("hides the uploader until the button is clicked", () => {
    render(<ConventionUploadPanel conventionId="c1" conventionName="Con One" />);
    expect(screen.queryByTestId("uploader")).toBeNull();
  });

  it("reveals the uploader (with the fixed convention) on click and hides it again", () => {
    render(<ConventionUploadPanel conventionId="c1" conventionName="Con One" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(screen.getByTestId("uploader").textContent).toBe("uploader:c1");
    fireEvent.click(button);
    expect(screen.queryByTestId("uploader")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npm run test -- src/components/__tests__/ConventionUploadPanel.test.tsx
```
Expected: FAIL — `ConventionUploadPanel` does not exist yet.

- [ ] **Step 3: Implement the component**

Create `src/components/ConventionUploadPanel.tsx`:
```tsx
"use client";

import { useState } from "react";
import Uploader from "@/app/upload/Uploader";

export default function ConventionUploadPanel({
  conventionId,
  conventionName,
}: {
  conventionId: string;
  conventionName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        {open ? "Hide uploader" : "Upload photos"}
      </button>
      {open ? (
        <div className="rounded-lg border border-border bg-card p-4">
          {conventionName ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Uploading to {conventionName}
            </p>
          ) : null}
          <Uploader fixedConventionId={conventionId} />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npm run test -- src/components/__tests__/ConventionUploadPanel.test.tsx
```
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full check**

Run:
```bash
npm run check
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConventionUploadPanel.tsx src/components/__tests__/ConventionUploadPanel.test.tsx
git commit -m "feat: add ConventionUploadPanel toggle component"
```

---

## Task 3: Wire the panel into the convention page

**Files:**
- Modify: `src/app/c/[slug]/page.tsx`

**Interfaces:**
- Consumes: `ConventionUploadPanel` (Task 2), `getCurrentUser` from `@/lib/auth-helpers`.

- [ ] **Step 1: Add the import and auth check, render the panel when signed in**

In `src/app/c/[slug]/page.tsx`:

Add these imports alongside the existing ones:
```tsx
import { getCurrentUser } from "@/lib/auth-helpers";
import ConventionUploadPanel from "@/components/ConventionUploadPanel";
```

After the existing `const showNsfw = ...` line (and before the `return`), add:
```tsx
  const user = await getCurrentUser();
```

In the JSX, add the panel as a sibling between the closing `</header>` and the `<PhotoGrid ... />`:
```tsx
      {user ? (
        <ConventionUploadPanel
          conventionId={convention.id}
          conventionName={convention.name}
        />
      ) : null}
```

- [ ] **Step 2: Run the full check**

Run:
```bash
npm run check
```
Expected: lint, typecheck, all tests, build pass. (Server component wiring is verified by typecheck + build; behavioral coverage of the panel toggle lives in Task 2's tests. There is no unit test for the RSC auth gate — it is verified at runtime in Step 3.)

- [ ] **Step 3: Runtime smoke check**

Run the dev server and confirm:
```bash
PORT=3200 npm run dev
```
- Signed OUT, visit a convention page (`/c/<slug>`): **no** "Upload photos" button appears.
- Signed IN, visit the same page: the "Upload photos" button appears; clicking it reveals the inline uploader with no convention picker; clicking again hides it.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/app/c/[slug]/page.tsx
git commit -m "feat: show inline upload panel on convention page for signed-in users"
```

---

## Self-Review

**Spec coverage:**
- Locked-mode `Uploader` (spec §3) → Task 1.
- `ConventionUploadPanel` toggle button + inline uploader (spec §2) → Task 2.
- Convention page auth-gated wiring, page stays public (spec §1) → Task 3.
- Pipeline reuse / no API changes (spec §4) → no task needed (inherent — `Uploader` unchanged in its upload logic).
- Testing (spec Testing) → Task 1 (picker vs locked), Task 2 (toggle + fixed id passthrough), guard test enforces tokens.

**Placeholder scan:** No TBD/TODO; all code shown; every command has expected output.

**Type consistency:** `Uploader` prop `fixedConventionId?: string` (Task 1) matches its use in `ConventionUploadPanel` (Task 2) and the mock in Task 2's test; `ConventionUploadPanel` props `{ conventionId: string; conventionName?: string }` match the call site in Task 3. `conventions` is optional in Task 1, so `/upload`'s `<Uploader conventions={...} />` still typechecks.
