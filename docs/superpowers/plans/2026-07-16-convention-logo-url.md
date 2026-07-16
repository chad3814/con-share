# Convention Logo + URL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Admins can attach an optional logo image and an optional URL to a convention (in the create/edit admin form). Public pages show the logo and, when a URL is set, a 🔗 link next to the convention name.

**Design (approved):** Add `logoKey` + `url` to `Convention` (keep unused `bannerKey`). The logo is uploaded **through the create/edit server action** (no browser→S3, no presign): the action receives the File, resizes it with `sharp` (≤512px WebP, EXIF stripped), `putObject`s it to `conventions/{id}/logo.webp` (public via a bucket-policy addition), and sets `logoKey`. Accepted logo types: jpeg/png/webp (no SVG/HEIC). `url` validates as `z.url()`. The logo is served publicly via a bucket-policy statement for `conventions/*/logo.webp` (no CORS change — the browser only reads it via `<img>`).

**Tech Stack:** existing (Next 16.2, Prisma 7, sharp, `@aws-sdk/*`, zod 4.4, Tailwind v4, Vitest).

## Global Constraints
- 2-space; semicolons; no `any`/`unknown` (only sanctioned exception: `src/lib/prisma.ts`); lint 0 warnings.
- Commits require Chad's explicit approval; commit only if `npm run check` passes. Never push. Never Read `.env.local`.
- Admin-only mutations stay behind `requireAdmin` (unchanged); this feature adds fields, not new auth surfaces.
- Logo upload is through the server action (Vercel ~4.5MB action-body limit is fine for a logo); reject oversize/unsupported gracefully.

---

### Task 1: Schema — `logoKey` + `url`
- [ ] Add to `Convention` in `prisma/schema.prisma`: `logoKey String?` and `url String?` (keep `bannerKey`).
- [ ] `npx prisma validate` → `npx prisma migrate dev --name convention_logo_url` → `npx prisma generate`.
- [ ] `npm run typecheck` exit 0.
- [ ] Commit (verify + ask): `feat: add logoKey and url to Convention`.

---

### Task 2: Validation + S3 key + logo processing helpers
**Files:** `src/lib/validation/convention.ts`, `src/lib/s3.ts` (+`s3.test.ts`), `src/lib/logo.ts` (+`logo.test.ts`).
- [ ] **`convention.ts`**: add `url` to `conventionInputSchema` as an optional URL: `url: z.preprocess(emptyToUndefined, z.url().optional())`. (This flows into create/updateConvention automatically via their `data: { ...input }` spread — no change needed there for url.)
- [ ] **`s3.ts`**: add `export function conventionLogoKey(conventionId: string): string { return \`conventions/${conventionId}/logo.webp\`; }`. Add an s3.test case asserting the path.
- [ ] **`src/lib/logo.ts`** — `export async function processLogo(input: Buffer): Promise<Buffer>`: `sharp(input).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()` (sharp strips metadata by default). Also `export const ACCEPTED_LOGO_TYPES = ["image/jpeg","image/png","image/webp"] as const;`. Add `logo.test.ts`: feed a `sharp`-generated 800×800 PNG fixture → assert output is WebP, ≤512px, and (spot-check) metadata stripped. Mirror the existing `image.test.ts` fixture style.
- [ ] TDD the pure/near-pure bits (conventionLogoKey; processLogo via fixture). Verify test/typecheck/lint.
- [ ] Commit (verify + ask): `feat: add url validation, logo key builder, and processLogo`.

---

### Task 3: Admin form + server-action logo handling
**Files:** `src/app/admin/conventions/ConventionForm.tsx`, `src/app/admin/conventions/actions.ts` (+ its test).
- [ ] **ConventionForm** (add fields; keep existing): a `url` text input (`name="url"`, `type="url"`, `defaultValue={convention?.url ?? ""}`); a logo `<input type="file" name="logo" accept="image/jpeg,image/png,image/webp">`; when editing and `convention?.logoKey` is set, show the current logo (`<img src={publicUrl(convention.logoKey)}>` — note: ConventionForm is a client component; pass a resolved `logoUrl` prop from the page instead of calling `publicUrl` in the client) and a `<input type="checkbox" name="removeLogo">` "Remove logo". Add `enctype`/no special handling — server actions accept `File` in FormData automatically.
  - The form's `convention` prop currently is the Prisma `Convention`; add an optional `logoUrl?: string | null` prop the page computes via `publicUrl(convention.logoKey)` (server-side) and passes in.
- [ ] **actions.ts** — extend BOTH `createConventionAction` and `updateConventionAction` (after the existing `requireAdmin` + `parseConventionInput`, keeping order):
  - create: `const convention = await createConvention(input, admin.id);` then handle the logo (see helper below) for `convention.id`; `revalidate`; redirect (unchanged).
  - update: `await updateConvention(id, input);` then handle the logo for `id`.
  - **Logo handling helper** (local to actions.ts), given `conventionId` + `formData`:
    - `const removeLogo = formData.get("removeLogo") !== null;`
    - `const file = formData.get("logo");`
    - if `file instanceof File && file.size > 0`: validate `ACCEPTED_LOGO_TYPES.includes(file.type)` (ignore/throw a clean error otherwise); `const buf = Buffer.from(await file.arrayBuffer());` → `processLogo(buf)` → `putObject(conventionLogoKey(conventionId), webp, "image/webp")` → `prisma.convention.update({ where:{id:conventionId}, data:{ logoKey: conventionLogoKey(conventionId) } })`.
    - else if `removeLogo`: `deleteObjects([conventionLogoKey(conventionId)])` (best-effort) + `prisma.convention.update({ data:{ logoKey: null } })`.
    - else: leave as-is.
  - No `any`/`unknown` (`file instanceof File` narrows; `file.type`/`arrayBuffer()` are typed).
- [ ] **actions test**: extend the existing mock-based tests — assert an admin create/update with a valid logo File calls `putObject` (with the logo key + `image/webp`) and sets `logoKey`; `removeLogo` deletes + nulls; an unsupported type does NOT upload. Keep the existing auth-gate assertions.
- [ ] Verify test/typecheck/lint/build.
- [ ] Commit (verify + ask): `feat: admin form logo upload + url field`.
*(Full ConventionForm JSX written verbatim in the task brief at execution.)*

---

### Task 4: Public display — logo + 🔗 URL
**Files:** `src/components/ConventionCard.tsx`, `src/app/c/[slug]/page.tsx`, and `listPublicConventions`/`getConventionBySlug` in `src/lib/conventions.ts`.
- [ ] **conventions.ts**: ensure `ConventionListItem`/the gallery query select `logoKey` + `url` (they select the whole convention today via `...c`, so likely already included — confirm and add if a `select` narrows it). Resolve a `logoUrl` (via `publicUrl(logoKey)` when set) either in the data layer or the component (keep components dumb — prefer resolving `logoUrl` in the page/card from the key; ConventionCard is presentational and already receives `ConventionListItem`, so compute `publicUrl(convention.logoKey)` there is fine since it's a Server Component).
- [ ] **ConventionCard**: if `logoKey` set, render the logo `<img src={publicUrl(logoKey)} alt="">` in place of the letter placeholder; keep the placeholder fallback. If `url` set, render a `🔗` `<a href={url} target="_blank" rel="noopener noreferrer">` next to the name (accessible label, e.g. `aria-label={`${name} website`}`).
- [ ] **gallery header** (`c/[slug]/page.tsx`): show the logo (if set) near the heading and the 🔗 link next to the name when `url` set (same anchor pattern).
- [ ] **ConventionCard.test**: extend — a convention with `logoKey` renders an `<img>` (not the placeholder); a convention with `url` renders a link with the right href + `rel`.
- [ ] Verify test/typecheck/lint/build.
- [ ] Commit (verify + ask): `feat: show convention logo and url link on public pages`.

---

### Task 5: Bucket policy + wrap
- [ ] **Bucket policy** (controller does this via `aws` CLI at execution, not a subagent): add `arn:aws:s3:::con-share-237284831831-us-east-2-an/conventions/*/logo.webp` to the existing `PublicReadDerivatives` statement's `Resource` list (alongside the two photo-derivative patterns), so logos are publicly readable. Verify with a put-object + curl 200 (+ cleanup), like the Phase 3 infra smoke.
- [ ] `npm run check` green; keep E2E green (add `/dmca`-style public assertion only if it fits; a logo/url render needs seeded data — likely skip, note deferral).
- [ ] Commit any remaining docs (verify + ask).

---

## Self-Review
**Coverage:** logo storage (Task 1) ✅; url validation (Task 2) ✅; logo processing + key (Task 2) ✅; admin upload + remove + url field (Task 3) ✅; public logo + 🔗 (Task 4) ✅; public serving via bucket policy (Task 5) ✅.
**Placeholders:** Task 3 defers the ConventionForm JSX to its brief (flagged; concrete code, no TODO).
**Type consistency:** `conventionLogoKey`/`processLogo`/`ACCEPTED_LOGO_TYPES` (Task 2) used by Task 3; `url` added to `ConventionInput` (Task 2) flows through `createConvention`/`updateConvention` via their existing `data: { ...input }` spread; `logoUrl` prop threaded page→ConventionForm (Task 3) and card rendering (Task 4).
**Notes:** logo upload is admin-only through the server action (no CORS/presign); the bucket-policy addition is the only infra change (I'll apply it). Out of scope: SVG/HEIC logos, a wide banner (bannerKey stays unused).
