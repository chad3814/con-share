# Phase 2 — Conventions & Public Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can create/edit conventions; anyone can browse the public convention list and an individual convention's gallery (which shows an empty state until Phase 3 adds uploads).

**Architecture:** Builds on the Phase 1 foundation (Next.js 16 App Router, Prisma 7 + Neon, Auth.js v5, `requireAdmin`/`getCurrentUser` helpers, `src/proxy.ts`). Adds `Convention` + `Photo` models, a thin data-access module, pure slug/validation utilities, public Server-Component pages, and an admin section guarded by `requireAdmin` with server actions for create/edit.

**Tech Stack:** Same as Phase 1 — Next.js 16.2, React 19.2, TypeScript 5.9.3, Prisma 7.8 + Neon adapter, zod 4.4, Tailwind v4, Vitest 4, Playwright 1.61.

## Global Constraints

- **Code style:** 2-space indent; semicolons on optional-semicolon lines.
- **No `any` and no `unknown`** (ESLint-enforced; the only sanctioned exception is the existing `src/lib/prisma.ts` line).
- **Commits require Chad's explicit approval**; a commit is only allowed if `npm run check` (lint + typecheck + test + build) passes. Never push to a remote.
- **Multi-tenancy:** every convention-scoped query filters by `conventionId`; the public gallery only shows `published && status = READY` photos.
- **Auth:** admin routes/actions call `requireAdmin` server-side (never trust the client); `src/proxy.ts` already redirects unauthenticated `/admin` requests to `/login`.
- **Banners deferred to Phase 3:** keep the `bannerKey` column but build no banner upload UI; cards render a text/color placeholder.
- **No convention deletion in Phase 2** (create + edit only).
- **Secrets:** never Read `.env.local`; check presence without reading values.
- **Next 16 async APIs:** `params`/`searchParams` are async — always `await` them.
- **Testing strategy for Phase 2:** unit-test the PURE logic (slug, validation) and UI components; keep the data-access module a thin orchestration layer. **DB-integration tests are deferred** pending a dedicated test database (a Neon branch / `TEST_DATABASE_URL`) — tracked as a Phase 2 follow-up so we don't write mock-theater tests against the production DB. `log`/note this limitation; do not silently skip coverage.

---

## File Structure (end of Phase 2)

```
prisma/schema.prisma            # + PhotoStatus enum, Convention, Photo; User gains relations
prisma/migrations/<ts>_conventions_photos/
src/lib/
├─ slug.ts                      # slugify + uniqueSlug (pure/helper)  + slug.test.ts
├─ validation/convention.ts     # zod schema for create/edit + convention.test.ts
└─ conventions.ts               # data-access: list/get/create/update (thin)
src/components/
├─ ConventionCard.tsx           # + ConventionCard.test.tsx
└─ PhotoGrid.tsx                # grid + empty state + PhotoGrid.test.tsx
src/app/
├─ page.tsx                     # rewritten: public convention list
├─ c/[slug]/page.tsx            # public convention gallery
└─ admin/
   ├─ layout.tsx                # requireAdmin guard
   ├─ page.tsx                  # dashboard
   └─ conventions/
      ├─ page.tsx               # admin list
      ├─ actions.ts             # createConventionAction / updateConventionAction (server actions)
      ├─ ConventionForm.tsx     # shared client form
      ├─ new/page.tsx
      └─ [id]/edit/page.tsx
```

---

### Task 1: Data model — Convention + Photo + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<generated>/migration.sql` (via CLI)

**Interfaces:**
- Produces: `Convention` and `Photo` models + `PhotoStatus` enum on the generated client, and `User.conventionsCreated` / `User.photos` relations.

- [ ] **Step 1: Add the enum + models to `prisma/schema.prisma`** (after the existing `Role` enum / models)

```prisma
enum PhotoStatus {
  PENDING
  READY
  TAKEN_DOWN
  FAILED
}

model Convention {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String?
  location    String?
  startDate   DateTime?
  endDate     DateTime?
  bannerKey   String?
  createdById String
  createdBy   User      @relation("ConventionCreatedBy", fields: [createdById], references: [id])
  photos      Photo[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Photo {
  id                 String      @id @default(cuid())
  conventionId       String
  convention         Convention  @relation(fields: [conventionId], references: [id], onDelete: Cascade)
  uploaderId         String
  uploader           User        @relation("PhotoUploader", fields: [uploaderId], references: [id])
  status             PhotoStatus @default(PENDING)
  originalKey        String
  webKey             String?
  thumbKey           String?
  exifKey            String?
  published          Boolean     @default(false)
  nsfw               Boolean     @default(false)
  description        String?
  photographerCredit String?
  width              Int?
  height             Int?
  contentType        String?
  takenDownAt        DateTime?
  takenDownById      String?
  takedownReason     String?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  @@index([conventionId, published, status])
}
```

- [ ] **Step 2: Add relations to the existing `User` model** — inside `model User { ... }` add:

```prisma
  conventionsCreated Convention[] @relation("ConventionCreatedBy")
  photos             Photo[]      @relation("PhotoUploader")
```

- [ ] **Step 3: Validate, migrate, regenerate**

```bash
npx prisma validate
npx prisma migrate dev --name conventions_photos
npx prisma generate
```
Expected: schema valid; a new migration folder created + applied to Neon; client regenerated with `Convention`/`Photo`/`PhotoStatus`.

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit** (verify + ask first)

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Convention and Photo models"
```

---

### Task 2: Slug utility

**Files:**
- Create: `src/lib/slug.ts`, `src/lib/slug.test.ts`

**Interfaces:**
- Produces:
  - `slugify(name: string): string` — lowercase, non-alphanumerics → single `-`, trimmed of leading/trailing `-`.
  - `uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string>` — returns `base`, or `base-2`, `base-3`, … until `exists` returns false.

- [ ] **Step 1: Write failing tests** (`src/lib/slug.test.ts`)

```ts
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("LitRPG Con 2026")).toBe("litrpg-con-2026");
  });
  it("collapses runs of non-alphanumerics and trims", () => {
    expect(slugify("  Foo -- Bar!! ")).toBe("foo-bar");
  });
  it("returns empty string for all-symbol input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when unused", async () => {
    const result = await uniqueSlug("con", async () => false);
    expect(result).toBe("con");
  });
  it("suffixes until free", async () => {
    const taken = new Set(["con", "con-2"]);
    const result = await uniqueSlug("con", async (s) => taken.has(s));
    expect(result).toBe("con-3");
  });
});
```

- [ ] **Step 2: Run — confirm RED**

Run: `npm run test -- src/lib/slug.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(base))) return base;
  let n = 2;
  while (await exists(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Run — confirm GREEN**

Run: `npm run test -- src/lib/slug.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit** (verify + ask first)

```bash
git add src/lib/slug.ts src/lib/slug.test.ts
git commit -m "feat: add slug utility (slugify + uniqueSlug)"
```

---

### Task 3: Convention input validation

**Files:**
- Create: `src/lib/validation/convention.ts`, `src/lib/validation/convention.test.ts`

**Interfaces:**
- Produces:
  - `conventionInputSchema` — zod schema.
  - `type ConventionInput = { name: string; description?: string; location?: string; startDate?: Date; endDate?: Date }`.
  - `parseConventionInput(raw: unknownNOT — use `Record<string, FormDataEntryValue | undefined>` ... )` — see note.

> **No-`unknown` note:** the ESLint rule bans the `unknown` keyword. Type the parser input as `Record<string, FormDataEntryValue | null>` (what `Object.fromEntries(formData)` yields) rather than `unknown`. zod's `.parse` accepts it.

- [ ] **Step 1: Write failing tests** (`src/lib/validation/convention.test.ts`)

```ts
import { parseConventionInput } from "@/lib/validation/convention";

describe("parseConventionInput", () => {
  it("accepts a minimal valid input (name only)", () => {
    const result = parseConventionInput({ name: "LitRPG Con" });
    expect(result.name).toBe("LitRPG Con");
  });
  it("trims name and treats empty optional strings as undefined", () => {
    const result = parseConventionInput({ name: "  Con  ", description: "" });
    expect(result.name).toBe("Con");
    expect(result.description).toBeUndefined();
  });
  it("throws on empty name", () => {
    expect(() => parseConventionInput({ name: "   " })).toThrow();
  });
  it("coerces ISO date strings", () => {
    const result = parseConventionInput({ name: "Con", startDate: "2026-07-01" });
    expect(result.startDate instanceof Date).toBe(true);
  });
});
```

- [ ] **Step 2: Run — confirm RED**

Run: `npm run test -- src/lib/validation/convention.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/validation/convention.ts`**

```ts
import { z } from "zod";

const emptyToUndefined = (v: FormDataEntryValue | null | undefined) =>
  typeof v === "string" && v.trim() === "" ? undefined : v ?? undefined;

const optionalTrimmed = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalDate = z.preprocess(
  emptyToUndefined,
  z.coerce.date().optional(),
);

export const conventionInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: optionalTrimmed,
  location: optionalTrimmed,
  startDate: optionalDate,
  endDate: optionalDate,
});

export type ConventionInput = z.infer<typeof conventionInputSchema>;

export function parseConventionInput(
  raw: Record<string, FormDataEntryValue | null | undefined>,
): ConventionInput {
  return conventionInputSchema.parse(raw);
}
```

- [ ] **Step 4: Run — confirm GREEN**

Run: `npm run test -- src/lib/validation/convention.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit** (verify + ask first)

```bash
git add src/lib/validation/convention.ts src/lib/validation/convention.test.ts
git commit -m "feat: add convention input validation schema"
```

---

### Task 4: Convention data-access module

**Files:**
- Create: `src/lib/conventions.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `slugify`/`uniqueSlug` (`@/lib/slug`), `ConventionInput`.
- Produces (thin orchestration — no unit test; covered by pure-logic tests + E2E, per the testing-strategy constraint):
  - `listPublicConventions(): Promise<ConventionListItem[]>` — all conventions, newest first, each with `publishedPhotoCount` (count of `published && status = READY`).
  - `getConventionBySlug(slug: string): Promise<ConventionWithCounts | null>`.
  - `createConvention(input: ConventionInput, createdById: string): Promise<Convention>` — assigns a unique slug from the name.
  - `updateConvention(id: string, input: ConventionInput): Promise<Convention>`.
  - `type ConventionListItem = Convention & { publishedPhotoCount: number }`.

- [ ] **Step 1: Implement `src/lib/conventions.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { ConventionInput } from "@/lib/validation/convention";
import type { Convention } from "@/generated/prisma/client";

const publishedPhotoWhere = { published: true, status: "READY" as const };

export type ConventionListItem = Convention & { publishedPhotoCount: number };

export async function listPublicConventions(): Promise<ConventionListItem[]> {
  const conventions = await prisma.convention.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { photos: { where: publishedPhotoWhere } } } },
  });
  return conventions.map(({ _count, ...c }) => ({
    ...c,
    publishedPhotoCount: _count.photos,
  }));
}

export async function getConventionBySlug(
  slug: string,
): Promise<ConventionListItem | null> {
  const convention = await prisma.convention.findUnique({
    where: { slug },
    include: { _count: { select: { photos: { where: publishedPhotoWhere } } } },
  });
  if (!convention) return null;
  const { _count, ...c } = convention;
  return { ...c, publishedPhotoCount: _count.photos };
}

export async function createConvention(
  input: ConventionInput,
  createdById: string,
): Promise<Convention> {
  const slug = await uniqueSlug(slugify(input.name), async (s) => {
    const existing = await prisma.convention.findUnique({ where: { slug: s } });
    return existing !== null;
  });
  return prisma.convention.create({
    data: { ...input, slug, createdById },
  });
}

export async function updateConvention(
  id: string,
  input: ConventionInput,
): Promise<Convention> {
  return prisma.convention.update({ where: { id }, data: { ...input } });
}
```

> Note: `slugify` may return `""` (all-symbol name); validation guarantees a non-empty `name`, but if `slugify` yields `""`, `uniqueSlug("")` would produce `""`/`"-2"`. Guard: if `slugify(input.name)` is empty, fall back to base `"convention"`. Add that guard in Step 1: `const base = slugify(input.name) || "convention";`.

- [ ] **Step 2: Verify typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Commit** (verify + ask first)

```bash
git add src/lib/conventions.ts
git commit -m "feat: add convention data-access module"
```

---

### Task 5: Public landing — convention list

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/ConventionCard.tsx`, `src/components/ConventionCard.test.tsx`

**Interfaces:**
- Consumes: `listPublicConventions` (`@/lib/conventions`).
- Produces: a mobile-first landing that lists conventions (or an empty state), each linking to `/c/[slug]`.

- [ ] **Step 1: Create `src/components/ConventionCard.tsx`** (presentational; banner placeholder since banners are Phase 3)

```tsx
import Link from "next/link";
import type { ConventionListItem } from "@/lib/conventions";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default function ConventionCard({ convention }: { convention: ConventionListItem }) {
  const range = formatRange(convention.startDate, convention.endDate);
  return (
    <Link
      href={`/c/${convention.slug}`}
      className="block overflow-hidden rounded-lg border border-gray-200 transition hover:border-gray-400"
    >
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-2xl font-bold text-gray-400">
        {convention.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="space-y-1 p-4">
        <h2 className="font-semibold">{convention.name}</h2>
        {range ? <p className="text-sm text-gray-600">{range}</p> : null}
        {convention.location ? (
          <p className="text-sm text-gray-500">{convention.location}</p>
        ) : null}
        <p className="text-xs text-gray-400">
          {convention.publishedPhotoCount} photo{convention.publishedPhotoCount === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Write a component test** (`src/components/ConventionCard.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import ConventionCard from "@/components/ConventionCard";
import type { ConventionListItem } from "@/lib/conventions";

const base: ConventionListItem = {
  id: "c1",
  slug: "litrpg-con",
  name: "LitRPG Con",
  description: null,
  location: "Denver, CO",
  startDate: new Date("2026-07-01T00:00:00Z"),
  endDate: null,
  bannerKey: null,
  createdById: "u1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  publishedPhotoCount: 1,
};

describe("ConventionCard", () => {
  it("renders name, location, and singular photo count linking to the gallery", () => {
    render(<ConventionCard convention={base} />);
    expect(screen.getByText("LitRPG Con")).toBeInTheDocument();
    expect(screen.getByText("Denver, CO")).toBeInTheDocument();
    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/c/litrpg-con");
  });
});
```

- [ ] **Step 3: Rewrite `src/app/page.tsx`** to list conventions

```tsx
import ConventionCard from "@/components/ConventionCard";
import { listPublicConventions } from "@/lib/conventions";

export default async function HomePage() {
  const conventions = await listPublicConventions();
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Con-Share</h1>
        <p className="text-gray-600">Browse photos shared from conventions.</p>
      </div>
      {conventions.length === 0 ? (
        <p className="text-gray-500">No conventions yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conventions.map((c) => (
            <ConventionCard key={c.id} convention={c} />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test + build**

Run: `npm run test -- src/components/ConventionCard.test.tsx && npm run build`
Expected: test passes; build succeeds.

- [ ] **Step 5: Commit** (verify + ask first)

```bash
git add src/app/page.tsx src/components/ConventionCard.tsx src/components/ConventionCard.test.tsx
git commit -m "feat: public landing lists conventions"
```

---

### Task 6: Convention gallery page `/c/[slug]`

**Files:**
- Create: `src/app/c/[slug]/page.tsx`, `src/components/PhotoGrid.tsx`, `src/components/PhotoGrid.test.tsx`

**Interfaces:**
- Consumes: `getConventionBySlug`.
- Produces: a gallery page — 404 for unknown slug; header (name, dates, location); `PhotoGrid` with an empty state (no published photos exist until Phase 3).

- [ ] **Step 1: Create `src/components/PhotoGrid.tsx`** (empty state now; grid shape ready for Phase 3)

```tsx
export interface GalleryPhoto {
  id: string;
  webKey: string | null;
  thumbKey: string | null;
  nsfw: boolean;
  description: string | null;
}

export default function PhotoGrid({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500">
        No photos have been shared yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <div key={photo.id} className="aspect-square rounded bg-gray-100" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write a component test** (`src/components/PhotoGrid.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import PhotoGrid from "@/components/PhotoGrid";

describe("PhotoGrid", () => {
  it("shows an empty state when there are no photos", () => {
    render(<PhotoGrid photos={[]} />);
    expect(screen.getByText("No photos have been shared yet.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Create `src/app/c/[slug]/page.tsx`** (Next 16: `params` is async)

```tsx
import { notFound } from "next/navigation";
import PhotoGrid from "@/components/PhotoGrid";
import { getConventionBySlug } from "@/lib/conventions";

export default async function ConventionGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const convention = await getConventionBySlug(slug);
  if (!convention) notFound();

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{convention.name}</h1>
        {convention.location ? (
          <p className="text-gray-600">{convention.location}</p>
        ) : null}
        {convention.description ? (
          <p className="text-gray-600">{convention.description}</p>
        ) : null}
      </header>
      <PhotoGrid photos={[]} />
    </section>
  );
}
```

- [ ] **Step 4: Run test + build**

Run: `npm run test -- src/components/PhotoGrid.test.tsx && npm run build`
Expected: passes; build lists `/c/[slug]`.

- [ ] **Step 5: Commit** (verify + ask first)

```bash
git add "src/app/c/[slug]/page.tsx" src/components/PhotoGrid.tsx src/components/PhotoGrid.test.tsx
git commit -m "feat: convention gallery page with empty state"
```

---

### Task 7: Admin guard + dashboard + conventions list

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/conventions/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`/`isAdmin` (`@/lib/auth-helpers`, `@/lib/authz`), `prisma`.
- Produces: an admin section that redirects non-admins; a dashboard; a list of all conventions with edit links.

- [ ] **Step 1: Create the admin guard layout** (`src/app/admin/layout.tsx`) — `requireAdmin` throws, so use a redirect for a clean UX

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/login?callbackUrl=/admin");

  return (
    <div className="space-y-6">
      <nav className="flex gap-4 border-b border-gray-200 pb-3 text-sm">
        <Link href="/admin" className="font-medium">Dashboard</Link>
        <Link href="/admin/conventions" className="font-medium">Conventions</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the dashboard** (`src/app/admin/page.tsx`)

```tsx
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Admin</h1>
      <ul className="list-inside list-disc text-gray-700">
        <li>
          <Link href="/admin/conventions" className="underline">Manage conventions</Link>
        </li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Create the conventions list** (`src/app/admin/conventions/page.tsx`)

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminConventionsPage() {
  const conventions = await prisma.convention.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Conventions</h1>
        <Link href="/admin/conventions/new" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
          New convention
        </Link>
      </div>
      {conventions.length === 0 ? (
        <p className="text-gray-500">No conventions yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {conventions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <span>{c.name}</span>
              <Link href={`/admin/conventions/${c.id}/edit`} className="text-sm underline">Edit</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds; lists `/admin`, `/admin/conventions`.

- [ ] **Step 5: Commit** (verify + ask first)

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/conventions/page.tsx
git commit -m "feat: admin guard, dashboard, and conventions list"
```

---

### Task 8: Admin create/edit convention (forms + server actions)

**Files:**
- Create: `src/app/admin/conventions/actions.ts`, `src/app/admin/conventions/ConventionForm.tsx`, `src/app/admin/conventions/new/page.tsx`, `src/app/admin/conventions/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `parseConventionInput`, `createConvention`/`updateConvention`.
- Produces: server actions that create/update conventions (admin-only, validated) and redirect to the list; a shared form used by new + edit.

- [ ] **Step 1: Create server actions** (`src/app/admin/conventions/actions.ts`)

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseConventionInput } from "@/lib/validation/convention";
import { createConvention, updateConvention } from "@/lib/conventions";

export async function createConventionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const input = parseConventionInput(Object.fromEntries(formData));
  await createConvention(input, admin.id);
  revalidatePath("/admin/conventions");
  revalidatePath("/");
  redirect("/admin/conventions");
}

export async function updateConventionAction(id: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const input = parseConventionInput(Object.fromEntries(formData));
  await updateConvention(id, input);
  revalidatePath("/admin/conventions");
  revalidatePath("/");
  redirect("/admin/conventions");
}
```

- [ ] **Step 2: Create the shared form** (`src/app/admin/conventions/ConventionForm.tsx`) — client component; `action` prop is the bound server action

```tsx
import type { Convention } from "@/generated/prisma/client";

function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default function ConventionForm({
  action,
  convention,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  convention?: Convention;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input name="name" required defaultValue={convention?.name ?? ""} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea name="description" defaultValue={convention?.description ?? ""} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Location</span>
        <input name="location" defaultValue={convention?.location ?? ""} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <div className="flex gap-4">
        <label className="block flex-1">
          <span className="text-sm font-medium">Start date</span>
          <input type="date" name="startDate" defaultValue={toDateInput(convention?.startDate)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium">End date</span>
          <input type="date" name="endDate" defaultValue={toDateInput(convention?.endDate)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
      </div>
      <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">{submitLabel}</button>
    </form>
  );
}
```

- [ ] **Step 3: Create the "new" page** (`src/app/admin/conventions/new/page.tsx`)

```tsx
import ConventionForm from "../ConventionForm";
import { createConventionAction } from "../actions";

export default function NewConventionPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">New convention</h1>
      <ConventionForm action={createConventionAction} submitLabel="Create" />
    </section>
  );
}
```

- [ ] **Step 4: Create the "edit" page** (`src/app/admin/conventions/[id]/edit/page.tsx`) — binds `id` into the update action

```tsx
import { notFound } from "next/navigation";
import ConventionForm from "../../ConventionForm";
import { updateConventionAction } from "../../actions";
import { prisma } from "@/lib/prisma";

export default async function EditConventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const convention = await prisma.convention.findUnique({ where: { id } });
  if (!convention) notFound();

  const action = updateConventionAction.bind(null, id);
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Edit convention</h1>
      <ConventionForm action={action} convention={convention} submitLabel="Save" />
    </section>
  );
}
```

- [ ] **Step 5: Verify check**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed; build lists `/admin/conventions/new` and `/admin/conventions/[id]/edit`.

- [ ] **Step 6: Manual smoke (documented; admin-authenticated E2E deferred)** — log in as an admin, create a convention, confirm it appears on `/admin/conventions` and `/`, edit it.

- [ ] **Step 7: Commit** (verify + ask first)

```bash
git add src/app/admin/conventions
git commit -m "feat: admin create/edit convention forms and server actions"
```

---

### Task 9: E2E smoke + Phase 2 wrap

**Files:**
- Modify: `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: E2E coverage for the public surface that doesn't require auth.

- [ ] **Step 1: Extend `e2e/smoke.spec.ts`** with public-surface checks (add to the existing file)

```ts
test("landing shows the conventions heading and no-conventions/empty content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Con-Share" })).toBeVisible();
});

test("unknown convention slug returns 404", async ({ page }) => {
  const res = await page.goto("/c/does-not-exist");
  expect(res?.status()).toBe(404);
});

test("admin is gated behind login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 2: Run E2E**

Run: `npm run test:e2e`
Expected: all pass (home render + unknown-slug 404 + admin gated + the two original smoke tests).

- [ ] **Step 3: Full check**

Run: `npm run check`
Expected: lint + typecheck + all unit tests + build pass.

- [ ] **Step 4: Commit** (verify + ask first)

```bash
git add e2e/smoke.spec.ts
git commit -m "test: e2e smoke for public convention surface"
```

---

## Self-Review

**Spec coverage (Phase-2 slice):**
- Convention model (admin-created, public list) → Tasks 1, 5, 7, 8. ✅
- Photo model (skeleton for the gallery query) → Task 1. ✅ (population deferred to Phase 3)
- `/` public convention list → Task 5. ✅
- `/c/[slug]` gallery, only `published && READY` photos, empty state → Tasks 4, 6. ✅
- Admin convention CRUD (create/edit; **no delete** per decision) → Tasks 7, 8. ✅
- Banners deferred (column kept, placeholder rendered) → Tasks 1, 5. ✅
- Authorization enforced in `requireAdmin` server-side + proxy redirect → Tasks 7, 8 (+ Phase 1 proxy). ✅
- Mobile-first → Tasks 5, 6, 8. ✅
- Slug uniqueness → Tasks 2, 4. ✅

**Deferred (with reason):**
- Tag/PhotoTag, Report, AuditLog models → their phases (4, 5).
- Real photo rendering, NSFW blur, tag filtering → Phase 3/4 (gallery shows empty state now).
- Banner upload → Phase 3.
- DB-integration tests for the data-access layer + server actions, and admin-authenticated E2E → deferred pending a test database (`TEST_DATABASE_URL` / Neon branch). Pure logic (slug, validation) and components ARE unit-tested; the data-access module is deliberately thin. This is a stated, non-silent limitation.

**Placeholder scan:** No TODO/TBD; every code step is complete. The Task 3 interface block contains a deliberate inline "NOT" annotation steering the implementer away from `unknown` — it is guidance, not a placeholder; the actual signature uses `Record<string, FormDataEntryValue | null | undefined>`.

**Type consistency:** `ConventionListItem` defined in Task 4 and consumed in Tasks 5/6; `ConventionInput`/`parseConventionInput` defined in Task 3 and consumed in Tasks 4/8; `createConvention`/`updateConvention` signatures match between Task 4 and Task 8. `getCurrentUser`/`isAdmin`/`requireAdmin` reused from Phase 1 with their existing signatures.

**Known risk to watch during execution:** server actions (`actions.ts`) call `requireAdmin`, which throws `AuthError` on non-admins; the `/admin` layout already redirects non-admins, and the proxy blocks unauthenticated access, so the actions are defense-in-depth. If a thrown `AuthError` surfaces an ugly error to an admin whose session expired mid-form, that's acceptable for MVP (documented).
