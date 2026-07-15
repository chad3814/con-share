# Phase 4 — Photo Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uploaders manage their own photos on `/me` — toggle `published` (making them appear in the public gallery), set NSFW / description / photographer credit / tags — with global tag autocomplete; viewers see NSFW photos blurred with click-to-reveal and a cookie-backed "show NSFW" preference; users can edit their display name and hard-delete their own photos. Also folds in the deferred Phase-3 correctness fixes.

**Architecture:** Builds on Phases 1–3. Adds `Tag` + `PhotoTag` models; tag utilities + data-access; a tag-autocomplete route + `TagInput` client component; ownership-gated photo server actions (update/publish/delete); the `/me` management page; and NSFW blur/reveal driven by a server-readable cookie.

**Tech Stack:** Same as Phases 1–3 (Next 16.2, React 19.2, TS 5.9.3, Prisma 7.8 + Neon, zod 4.4, Tailwind v4, Vitest 4, Playwright 1.61) + S3 (`@aws-sdk/*`, `sharp`, `heic-convert`, `exifr`).

## Global Constraints

- 2-space indent; semicolons; no `any`/`unknown` (ESLint-enforced; only sanctioned exception is `src/lib/prisma.ts`). Lint must stay at 0 warnings.
- Commits require Chad's explicit approval; commit only if `npm run check` passes. Never push. Never Read `.env.local`.
- **Auth/ownership:** photo mutations (update/publish/delete) require the caller to be the photo's uploader **or** an admin — enforced server-side, never trust the client. `/me` and `/upload` are login-gated (proxy + server checks).
- **Tags:** global, normalized to lowercase + trimmed; deduped. Autocomplete suggests any existing tag by prefix.
- **NSFW:** viewer preference stored in a cookie `show_nsfw` (`"1"`/absent), readable server-side so the Server-Component gallery decides initial blur (no flash). NSFW photos render blurred with click-to-reveal unless the preference is set.
- **Self-delete = HARD delete:** removes the `Photo` row AND all its S3 objects (`original`, `metadata.exif`, `web`, `thumb`). (Admin soft-remove/audit is Phase 5, separate.)
- **Publish gate:** `published` only meaningful for `status = READY` photos; a photo appears in the public gallery iff `published && status = READY`.
- Uploads still land `published=false` (from Phase 3); this phase adds the toggle that publishes them.

## Deferred Phase-3 fixes folded in (Task 1)
- `image.ts`: store `width`/`height` from the ROTATED derivative (currently read pre-`.rotate()` → transposed for portrait photos).
- process route: add a server-side status guard (skip/short-circuit if already `READY`) to complement the client re-click no-op.
- `s3.ts`: rename `presignPut`'s `maxBytes` param to `contentLength` (it's an exact signed length now).
- `Uploader.tsx`: client-side extension→MIME fallback so a browser reporting empty `file.type` for `.heic` still uploads.

---

## File Structure (Phase 4 additions/changes)

```
prisma/schema.prisma            # + Tag, PhotoTag; User/Photo relations
prisma/migrations/<ts>_tags/
src/lib/
├─ tags.ts                      # normalizeTagName, setPhotoTags, searchTags, photoTagNames  + tags.test.ts
├─ image.ts                     # (fix) dims from rotated derivative
├─ s3.ts                        # (fix) presignPut param rename
└─ nsfw.ts                      # showNsfwFromCookies(cookieStore) helper  + nsfw.test.ts
src/app/
├─ api/tags/route.ts            # GET ?q= -> tag suggestions
├─ me/
│  ├─ page.tsx                  # server: my uploads + display name
│  ├─ MyPhotos.tsx              # client: per-photo edit/publish/delete
│  └─ actions.ts                # updatePhoto / setPublished / deletePhoto / updateDisplayName (ownership-gated)  + actions.test.ts
├─ upload/Uploader.tsx          # (fix) file.type fallback
└─ api/uploads/[photoId]/process/route.ts  # (fix) status guard
src/components/
├─ TagInput.tsx                 # client tag entry + autocomplete
└─ PhotoGrid.tsx                # NSFW blur + click-to-reveal (+ showNsfw prop)
```

---

### Task 1: Deferred Phase-3 correctness fixes

**Files:** Modify `src/lib/image.ts`, `src/app/api/uploads/[photoId]/process/route.ts`, `src/lib/s3.ts`, `src/app/upload/Uploader.tsx`, `src/lib/image.test.ts`.

- [ ] **Step 1 — image.ts dims from rotated output.** Compute `width`/`height` from the rotated pipeline so orientation-tagged photos report the displayed dimensions. E.g. capture the web derivative with info: `const { data: web, info } = await sharp(decoded).rotate().resize({...}).webp({quality:82}).toBuffer({ resolveWithObject: true });` — but that gives the RESIZED size, not the original. Instead, read post-rotate original dims once: `const rotatedMeta = await sharp(decoded).rotate().metadata();` and use `rotatedMeta.width/height`. Return those as `width`/`height`.
- [ ] **Step 2 — image.test.ts** add an orientation case: build a fixture with `.withMetadata({ orientation: 6 })` (or `.withExif` orientation) on a landscape-stored image and assert `processImage` reports the DISPLAY dims (swapped) — or, if generating an oriented fixture is impractical, assert dims match a `sharp(web).metadata()`-derived expectation. Keep existing tests green.
- [ ] **Step 3 — process route status guard.** After loading the photo + auth, add: `if (photo.status === "READY") return NextResponse.json({ status: "READY", webUrl: publicUrl(photo.webKey!) }, ...)` — short-circuit so a repeat call doesn't reprocess. (Use the existing webKey; it's set when READY.)
- [ ] **Step 4 — s3.ts rename** `presignPut(key, contentType, maxBytes)` → `presignPut(key, contentType, contentLength)` and update the presign route caller. Behavior unchanged.
- [ ] **Step 5 — Uploader.tsx file.type fallback.** Before building the presign request, compute a content type per file: if `file.type` is non-empty use it; else map by extension (`.heic`→`image/heic`, `.heif`→`image/heif`, `.jpg/.jpeg`→`image/jpeg`, `.png`→`image/png`, `.webp`→`image/webp`). Send that as `contentType`.
- [ ] **Step 6 — verify** `npm run check` green (tests/typecheck/lint 0 warnings/build).
- [ ] **Step 7 — commit** (verify + ask): `fix: correct rotated dims, process status guard, presign param name, HEIC content-type fallback`.

---

### Task 2: Tag + PhotoTag models

**Files:** Modify `prisma/schema.prisma`; create migration.

- [ ] **Step 1 — add models** (after `Photo`):

```prisma
model Tag {
  id        String     @id @default(cuid())
  name      String     @unique
  photos    PhotoTag[]
  createdAt DateTime   @default(now())
}

model PhotoTag {
  photoId String
  tagId   String
  photo   Photo @relation(fields: [photoId], references: [id], onDelete: Cascade)
  tag     Tag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([photoId, tagId])
  @@index([tagId])
}
```
Add to `Photo`: `tags PhotoTag[]`.

- [ ] **Step 2 — migrate + generate**: `npx prisma validate` → `npx prisma migrate dev --name tags` → `npx prisma generate`.
- [ ] **Step 3 — typecheck** exit 0.
- [ ] **Step 4 — commit** (verify + ask): `feat: add Tag and PhotoTag models`.

---

### Task 3: Tag utilities + data-access

**Files:** Create `src/lib/tags.ts`, `src/lib/tags.test.ts`.

**Interfaces (Produces):**
- `normalizeTagName(raw: string): string` — trim + lowercase + collapse internal whitespace to single spaces; returns "" if empty. Pure.
- `normalizeTagList(raw: string[]): string[]` — normalize each, drop empties, dedupe, cap at (say) 20. Pure.
- `setPhotoTags(photoId: string, names: string[]): Promise<void>` — upsert each normalized tag, replace the photo's PhotoTag rows to exactly this set (in a transaction).
- `photoTagNames(photoId: string): Promise<string[]>`.
- `searchTags(prefix: string, limit = 10): Promise<string[]>` — normalized-prefix match, ordered by name.

- [ ] **Step 1 — failing tests** for the PURE functions (`normalizeTagName`: trims/lowercases/collapses whitespace, "" for blank; `normalizeTagList`: dedupe + drop empty + cap). Write concrete cases.
- [ ] **Step 2 — RED.**
- [ ] **Step 3 — implement** `src/lib/tags.ts` (pure fns + the prisma-backed `setPhotoTags`/`photoTagNames`/`searchTags`; the DB ones are thin — no unit test per the testing strategy, verified via typecheck/build + downstream).
- [ ] **Step 4 — GREEN + typecheck + lint.**
- [ ] **Step 5 — commit** (verify + ask): `feat: add tag utilities and data-access`.

*(Exact pure-fn test cases + code written verbatim in the task brief at execution time — mirror the Phase 2 validation task structure; no placeholders.)*

---

### Task 4: Tag autocomplete route + TagInput component

**Files:** Create `src/app/api/tags/route.ts`, `src/components/TagInput.tsx`.

- [ ] **Step 1 — route** `GET /api/tags?q=<prefix>` → `requireUser()` (401 on AuthError); `{ tags: await searchTags(q) }`. Empty `q` → return `{ tags: [] }`.
- [ ] **Step 2 — TagInput** (`"use client"`): controlled list of tag strings + a text field; on input, debounced `fetch('/api/tags?q=')` → suggestion dropdown; Enter/comma adds a tag; chips with remove; exposes selected tags via a hidden input (name `tags`, comma-joined) or a value/onChange prop. No `any`/`unknown`; type the fetch response with a local interface. (Full component code in the task brief at execution time.)
- [ ] **Step 3 — build + typecheck + lint.**
- [ ] **Step 4 — commit** (verify + ask): `feat: add tag autocomplete route and TagInput`.

---

### Task 5: Photo management server actions

**Files:** Create `src/app/me/actions.ts`, `src/app/me/actions.test.ts`.

**Interfaces (Produces) — all `"use server"`, all ownership-gated:**
- `updatePhotoAction(photoId, formData)` — fields: `description?`, `photographerCredit?`, `nsfw` (checkbox), `tags` (comma-joined). Loads photo; require caller is uploader or admin (else throw `AuthError`); validate; update Photo + `setPhotoTags`.
- `setPublishedAction(photoId, published: boolean)` — ownership-gated; only allow publish when `status === "READY"`.
- `deletePhotoAction(photoId)` — ownership-gated HARD delete: derive all keys from `originalKey` (original/exif/web/thumb) + `deleteObjects`, then `prisma.photo.delete` (PhotoTag rows cascade). `revalidatePath('/me')` + the photo's convention gallery.
- Helper `loadOwnedPhoto(photoId, user)` — loads photo, throws `AuthError` if not uploader/admin, returns it. Reused by all three.

- [ ] **Step 1 — failing auth-gate tests** (`actions.test.ts`, mock-based like Phase 2's admin actions): a non-owner non-admin caller is rejected (throws) and NO prisma mutation / NO `deleteObjects` runs, for update/publish/delete; an owner succeeds and the right calls happen. Mock `@/lib/auth-helpers`, `@/lib/prisma`, `@/lib/s3`, `@/lib/tags`, `next/cache`.
- [ ] **Step 2 — RED.**
- [ ] **Step 3 — implement** `actions.ts` with `loadOwnedPhoto` gate first in each action; validate with a small zod schema; hard-delete removes S3 objects before the row.
- [ ] **Step 4 — GREEN + typecheck + lint + build.**
- [ ] **Step 5 — commit** (verify + ask): `feat: add photo management server actions (update/publish/delete)`.

> After this task the controller runs a focused SECURITY review of the ownership boundary (like Phase 2's admin boundary / Phase 3's upload routes).

---

### Task 6: `/me` management page

**Files:** Create `src/app/me/page.tsx` (server), `src/app/me/MyPhotos.tsx` (client), and a display-name form.

- [ ] **Step 1 — page.tsx** server: `requireUser()`; load the user's photos across conventions (`prisma.photo.findMany({ where: { uploaderId: user.id }, include: convention name + tags, orderBy createdAt desc })`), resolve `thumbUrl` via `publicUrl` for READY photos; render display-name form + `<MyPhotos photos={...} />`.
- [ ] **Step 2 — MyPhotos.tsx** client: per-photo row — thumbnail (or status chip if not READY), publish/unpublish toggle (calls `setPublishedAction`, disabled unless READY), an edit form (description, photographer credit, NSFW checkbox, `TagInput`) submitting `updatePhotoAction`, and a delete button (confirm) calling `deletePhotoAction`. Mobile-first. (Full component code in the task brief at execution.)
- [ ] **Step 3 — display name**: a small form on `/me` calling `updateDisplayNameAction(formData)` (add to `actions.ts` — `requireUser`, validate non-empty, update `user.displayName`).
- [ ] **Step 4 — build + typecheck + lint (0 warnings).**
- [ ] **Step 5 — manual smoke (documented):** publish a READY photo → it appears in `/c/[slug]`; edit tags/description/credit/nsfw; delete a photo → row + S3 objects gone.
- [ ] **Step 6 — commit** (verify + ask): `feat: add /me photo management page`.

---

### Task 7: NSFW blur + cookie preference

**Files:** Create `src/lib/nsfw.ts`, `src/lib/nsfw.test.ts`; modify `src/components/PhotoGrid.tsx`, `src/app/c/[slug]/page.tsx`; add a small `NsfwToggle.tsx` client component.

- [ ] **Step 1 — nsfw.ts**: `SHOW_NSFW_COOKIE = "show_nsfw"`; `showNsfwFromCookie(value: string | undefined): boolean` (true iff `value === "1"`). Pure — unit-test it.
- [ ] **Step 2 — PhotoGrid**: accept a `showNsfw: boolean` prop. For `photo.nsfw && !showNsfw`, render the thumbnail blurred (`blur-lg`) under a "Sensitive content — tap to reveal" overlay that reveals on click (client interaction — split a small `<NsfwThumb>` client subcomponent, since PhotoGrid is otherwise server-rendered). Non-NSFW or when `showNsfw` → render normally.
- [ ] **Step 3 — gallery page**: read the cookie via `await cookies()` (Next 16 async), compute `showNsfw`, pass to `PhotoGrid`. Render an `<NsfwToggle initial={showNsfw} />` that sets/clears the `show_nsfw` cookie (via a tiny server action or `document.cookie`) and refreshes.
- [ ] **Step 4 — nsfw test GREEN; build + typecheck + lint (0 warnings).**
- [ ] **Step 5 — commit** (verify + ask): `feat: NSFW blur with click-to-reveal and cookie preference`.

---

### Task 8: Wrap — full check + E2E

- [ ] **Step 1** `npm run check` green.
- [ ] **Step 2** extend `e2e/smoke.spec.ts` if a no-auth public assertion fits (e.g. a published photo shows in a gallery requires seeded data — likely skip; note deferral). At minimum keep the 3 existing E2E green.
- [ ] **Step 3** `npm run test:e2e` green.
- [ ] **Step 4 — commit** any remaining docs (verify + ask).

---

## Self-Review

**Spec coverage (Phase-4 slice):** publish toggle (Task 5/6) ✅; NSFW blur + click-to-reveal + "show NSFW" preference (Task 7) ✅; tags + global autocomplete (Tasks 2–4) ✅; photographer credit + description editing (Task 5/6) ✅; `/me` global my-uploads view (Task 6) ✅; display-name editing (Task 6) ✅; self hard-delete incl. S3 objects (Task 5) ✅. Plus the deferred Phase-3 fixes (Task 1) ✅.

**Deferred to Phase 5:** reporting (report button, `/dmca`), admin moderation queue, soft-remove + AuditLog, takedown. Report/AuditLog models added there.

**Placeholders:** Tasks 3, 4, 6 defer verbatim test-case/component code to their execution-time briefs (flagged; to be filled with concrete code, no TODOs). All other tasks carry complete code/steps.

**Type consistency:** `normalizeTagName`/`normalizeTagList`/`setPhotoTags`/`searchTags` (Task 3) consumed by Tasks 4/5; `loadOwnedPhoto` + the three actions (Task 5) consumed by Task 6; `showNsfwFromCookie` (Task 7) used by the gallery; `GalleryPhoto` gains no shape change (blur is a render concern via the new `showNsfw` prop).

**Security note:** Task 5 is the sensitive surface — every action gates via `loadOwnedPhoto` (uploader-or-admin) BEFORE any mutation/S3 delete; the controller runs a dedicated ownership-boundary review after Task 5, and the auth-gate tests assert non-owners cause no mutation/no S3 delete.
