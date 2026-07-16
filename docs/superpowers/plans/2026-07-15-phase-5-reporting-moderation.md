# Phase 5 — Reporting & Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Anyone (logged-in or out) can report a photo via an in-app form (category + optional message) with lightweight anti-spam; a dedicated `/dmca` page files formal copyright takedown notices; admins work an `/admin/reports` moderation queue to **soft-remove** photos (status → `TAKEN_DOWN`, public derivatives deleted, private original + `.exif` retained, actor/reason recorded in an `AuditLog`, linked reports resolved) or dismiss reports. Taken-down photos drop from public galleries, show a tombstone on the single-photo view, and appear on the uploader's `/me` marked "taken down" with the reason.

**Architecture:** Adds `Report` + `AuditLog` models; report validation + data-access with rate-limiting; a new single-photo view (`/c/[slug]/p/[photoId]`) hosting the Report button; a `/dmca` form; admin moderation server actions (`requireAdmin`) + an `/admin/reports` queue. Completes the product.

**Tech Stack:** Same as Phases 1–4.

## Global Constraints
- 2-space; semicolons; no `any`/`unknown` (only sanctioned exception: `src/lib/prisma.ts`); lint 0 warnings.
- Commits require Chad's explicit approval; commit only if `npm run check` passes. Never push. Never Read `.env.local`.
- **Reporting is public** (logged-out allowed). Attribute logged-in reports by `reporterUserId`; anonymous by `reporterIp` (from request headers). **Rate-limit:** at most one OPEN report per (photo, reporter) — dedupe — AND a rolling cap per IP (e.g. 10/hour). Reject (silently succeed to the user) beyond that.
- **Report categories:** `ABUSE | COPYRIGHT | OTHER`. Copyright reports nudge the user toward `/dmca` (the fuller form) but both feed the same queue.
- **Moderation is admin-only** (`requireAdmin`, server-side, before any mutation). 
- **Soft-remove (takedown):** `status → TAKEN_DOWN`; set `takenDownAt/ById/takedownReason`; delete ONLY the public `web`/`thumb` S3 objects; **retain** the private `original` + `metadata.exif`; write an `AuditLog` row; set all OPEN reports for that photo to `RESOLVED`. Never hard-delete here.
- **Gallery/visibility:** `getPublishedPhotos` already filters `published && status = READY`, so `TAKEN_DOWN` auto-drops. Single-photo view shows a tombstone for `TAKEN_DOWN` (never the image). `/me` shows taken-down photos with the reason, not editable/publishable.
- **AuditLog.photoId is a bare column (no FK)** so the trail survives any future hard-delete of the photo.

## File Structure (Phase 5 additions)
```
prisma/schema.prisma            # + ReportCategory/ReportStatus enums, Report, AuditLog; relations
prisma/migrations/<ts>_reports/
src/lib/
├─ validation/report.ts         # reportInputSchema + parse  + report.test.ts
├─ reports.ts                   # createReport (rate-limit/dedupe), listOpenReports, rate-limit pure helper  + reports.test.ts
└─ moderation.ts                # takedownPhoto, dismissReport data-access (used by actions)
src/app/
├─ c/[slug]/p/[photoId]/
│  ├─ page.tsx                  # single-photo view (image or tombstone) + ReportButton
│  └─ ReportForm.tsx            # client report form (category + message)
├─ report/actions.ts            # createReportAction (anonymous-capable, IP rate-limit)  + actions.test.ts
├─ dmca/page.tsx                # DMCA form -> COPYRIGHT report
├─ admin/reports/
│  ├─ page.tsx                  # moderation queue
│  ├─ ReportQueue.tsx           # client: per-report takedown/dismiss
│  └─ actions.ts                # takedownPhotoAction / dismissReportAction (requireAdmin)  + actions.test.ts
└─ me/MyPhotos.tsx              # (edit) show TAKEN_DOWN state + reason
```

---

### Task 1: Report + AuditLog models
- [ ] **Step 1 — schema** (after `PhotoTag`):
```prisma
enum ReportCategory { ABUSE COPYRIGHT OTHER }
enum ReportStatus { OPEN RESOLVED DISMISSED }

model Report {
  id             String         @id @default(cuid())
  photoId        String
  photo          Photo          @relation(fields: [photoId], references: [id], onDelete: Cascade)
  reporterUserId String?
  reporter       User?          @relation("ReportReporter", fields: [reporterUserId], references: [id])
  reporterIp     String?
  category       ReportCategory
  message        String?
  contactEmail   String?
  status         ReportStatus   @default(OPEN)
  resolvedById   String?
  resolvedBy     User?          @relation("ReportResolver", fields: [resolvedById], references: [id])
  resolvedAt     DateTime?
  resolutionNote String?
  createdAt      DateTime       @default(now())

  @@index([status, createdAt])
  @@index([photoId])
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  actor     User     @relation("AuditActor", fields: [actorId], references: [id])
  photoId   String?
  action    String
  reason    String?
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```
Add to `Photo`: `reports Report[]`. Add to `User`: `reportsMade Report[] @relation("ReportReporter")`, `reportsResolved Report[] @relation("ReportResolver")`, `auditLogs AuditLog[] @relation("AuditActor")`.
- [ ] **Step 2** `npx prisma validate` → `migrate dev --name reports` → `generate`.
- [ ] **Step 3** typecheck exit 0.
- [ ] **Step 4 — commit** (verify + ask): `feat: add Report and AuditLog models`.

---

### Task 2: Report validation + data-access
**Produces:** `reportInputSchema`/`parseReportInput` (category enum, `message?` max 2000, `contactEmail?` email); `shouldRejectReport(hasOpenFromReporter: boolean, recentIpCount: number, cap: number): boolean` (pure); `createReport(input, reporter: { userId?: string; ip?: string }): Promise<void>` (dedupe + IP cap, thin); `listOpenReports()` (thin).
- [ ] TDD: test `parseReportInput` (valid category; rejects bad category; message length cap; optional contactEmail must be an email if present) and `shouldRejectReport` (rejects when hasOpenFromReporter; rejects when recentIpCount >= cap; allows otherwise). RED → implement → GREEN.
- [ ] Implement `src/lib/validation/report.ts` + `src/lib/reports.ts` (DB fns thin, dynamic-import prisma pattern used by tags.ts — OR statically import; note the vitest constraint). Verify typecheck/lint.
- [ ] **Commit** (verify + ask): `feat: add report validation and data-access`.
*(Exact test cases + code in the task brief at execution; no placeholders.)*

---

### Task 3: Single-photo view + Report button/form + report action
**Files:** `src/app/c/[slug]/p/[photoId]/page.tsx`, `.../ReportForm.tsx`, `src/app/report/actions.ts`, `src/app/report/actions.test.ts`.
- [ ] **Single-photo page** (server): load photo by id (scoped to the slug's convention). If `TAKEN_DOWN` → render a tombstone ("This photo has been removed.") — never the image, never the description. If published & READY → show the full `web` image (via `publicUrl`), description, tags, photographer credit or uploader `displayName`, and a Report affordance (`ReportForm`). If not published/READY and viewer isn't the uploader/admin → 404. Respect NSFW blur (reuse `PhotoThumb`/cookie or a full-size blur).
- [ ] **ReportForm** (client): category select (Abuse/Copyright/Other) + optional message; a note that copyright claims should use `/dmca` (link). Submits `createReportAction.bind(null, photoId)`.
- [ ] **createReportAction** (`"use server"`): reads the viewer (via `getCurrentUser`, may be null) and the IP from `headers()` (`x-forwarded-for`); validates input; calls `createReport(input, { userId, ip })`. Always resolves to the user as "reported" (don't leak whether it was deduped/rate-limited). No auth required (public).
- [ ] **actions.test.ts:** mock-based — verify anonymous path (no user) still creates with ip; dedupe/rate-limit path does not create a second report; validation rejects a bad category.
- [ ] **Commit** (verify + ask): `feat: add single-photo view with report button`.
*(Component/page code in the task brief at execution.)*

---

### Task 4: `/dmca` page
**Files:** `src/app/dmca/page.tsx` (+ a client form if needed).
- [ ] A form collecting: the infringing photo URL or id, complainant name, `contactEmail` (required), and a good-faith/accuracy statement checkbox + free-text claim. On submit (server action), resolve the photo id from the URL/id, and `createReport({ category: "COPYRIGHT", message: <claim>, contactEmail }, { ip })`. Show a confirmation. Validate email + required fields.
- [ ] **Commit** (verify + ask): `feat: add /dmca takedown form`.
*(Form code in the task brief.)*

---

### Task 5: Admin moderation actions
**Files:** `src/lib/moderation.ts`, `src/app/admin/reports/actions.ts`, `src/app/admin/reports/actions.test.ts`.
**Produces (all `requireAdmin` FIRST):**
- `takedownPhotoAction(photoId, formData|reason)` — `requireAdmin`; load photo; in a transaction: set `status=TAKEN_DOWN`, `takenDownAt=now`, `takenDownById=admin.id`, `takedownReason=reason`; set all OPEN reports for the photo to `RESOLVED` (resolvedBy/At); create an `AuditLog` (`action:"takedown"`, reason, photoId). Then delete the public `web`/`thumb` S3 objects (derive keys from `originalKey`; do NOT delete `original`/`metadata.exif`). `revalidatePath` `/admin/reports`, `/me`, and the convention gallery.
- `dismissReportAction(reportId, formData|note)` — `requireAdmin`; set the report `status=DISMISSED`, `resolvedBy/At`, `resolutionNote=note`; `AuditLog` (`action:"dismiss_report"`); revalidate.
- [ ] **auth-gate tests** (mock-based, like Phase 4): a non-admin caller is rejected (throws AuthError) and NO status change / NO S3 delete / NO AuditLog write; an admin succeeds (takedown flips status + resolves reports + writes audit + deletes ONLY web/thumb; dismiss sets DISMISSED). Assert original/exif keys are NOT in the `deleteObjects` argument.
- [ ] Implement; verify test/typecheck/lint/build.
- [ ] **Commit** (verify + ask): `feat: add moderation takedown/dismiss actions`.
> Controller runs a focused SECURITY review of the admin-moderation boundary after this task.

---

### Task 6: Admin moderation queue `/admin/reports`
**Files:** `src/app/admin/reports/page.tsx`, `.../ReportQueue.tsx`; add a nav link in `src/app/admin/layout.tsx`.
- [ ] Queue page (server, under the admin layout guard): `listOpenReports()` with photo + reporter info; render each with the photo thumbnail (even if unpublished — admins can view), category, message, reporter (user or "anonymous"), and takedown (with a reason input) + dismiss (with a note) controls bound to the Task-5 actions. Group by photo where practical.
- [ ] Add "Reports" to the admin nav.
- [ ] **Commit** (verify + ask): `feat: add admin moderation queue`.
*(Component code in the task brief.)*

---

### Task 7: `/me` shows taken-down photos
- [ ] Update `/me` page query + `MyPhotos.tsx`: include `TAKEN_DOWN` photos; render them with a "Taken down" badge + `takedownReason`, and DISABLE edit/publish/delete controls for them (a taken-down photo can't be republished by the uploader). Keep everything else.
- [ ] **Commit** (verify + ask): `feat: show taken-down photos on /me with reason`.

---

### Task 8: Wrap
- [ ] `npm run check` green; extend `e2e/smoke.spec.ts` if a no-auth assertion fits (e.g. `/dmca` renders; a `TAKEN_DOWN` single-photo shows tombstone requires seeded data — likely skip, note deferral); keep existing E2E green.
- [ ] `npm run test:e2e` green.
- [ ] **Commit** any remaining docs (verify + ask).

---

## Self-Review
**Spec coverage:** in-app Report button, logged-out allowed, category + message (Tasks 2,3) ✅; `/dmca` form (Task 4) ✅; admin moderation queue (Task 6) ✅; soft-remove with audit trail — TAKEN_DOWN, delete public derivatives, retain private original+exif, AuditLog, resolve reports (Task 5) ✅; dismiss (Task 5) ✅; tombstone + gallery exclusion + `/me` taken-down view (Tasks 3,7; gallery filter already excludes) ✅; single global admin role (reuses `requireAdmin`) ✅; rate-limit for anonymous (Task 2) ✅.
**Placeholders:** Tasks 2,3,4,6 defer verbatim test/component code to execution-time briefs (flagged; concrete code, no TODOs).
**Type consistency:** `parseReportInput`/`createReport`/`shouldRejectReport` (Task 2) used by Tasks 3,4; `takedownPhotoAction`/`dismissReportAction` (Task 5) used by Task 6; `listOpenReports` (Task 2) used by Task 6.
**Security:** Task 5 is the sensitive surface — `requireAdmin` before any mutation; auth-gate tests assert non-admin causes no takedown/no S3 delete/no audit; the deleteObjects call must exclude original/exif (asserted). Public report action is intentionally auth-free but rate-limited + input-validated; it never reveals dedupe/limit outcomes.
**Deferred (whole-project, post-Phase-5):** make `prisma.ts` lazy; email notifications for reports/DMCA (not in spec); the earlier deferred minors list; production Vercel origin in S3 CORS.
