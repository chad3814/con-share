# Con-Share — Convention Photo Sharing — Design Spec

**Date:** 2026-07-14
**Status:** Approved (design), pending implementation plan

## Overview

Con-Share is a web app where convention attendees share photos they took. It
supports multiple conventions kept separate from one another. Photos are stored
in S3; each photo carries metadata in the database (NSFW flag, published flag,
optional description, optional tags, optional photographer credit). The site is
mobile-first (people upload from the con floor) and has admin tooling for
creating conventions, handling DMCA complaints, and moderating abuse.

Origin: built after attending LitRPG Con, a convention for LitRPG authors,
narrators, and enthusiasts.

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript, hosted on Vercel.
- **Database:** Neon (Postgres) via Prisma ORM.
- **Auth:** Auth.js v5 (NextAuth) with the Prisma adapter; Google + GitHub OAuth
  providers. Users/sessions stored in Neon.
- **Storage:** Single S3 bucket. Private originals + `.exif` sidecars;
  public-read `web` + `thumb` derivatives. `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`.
- **Image processing:** `sharp` inside a Next.js route handler.
- **Rendering:** Server Components for galleries; client components only where
  interactivity is required (upload, NSFW reveal, tag autocomplete, admin
  actions).
- **Testing:** Vitest (unit + integration), Playwright (E2E smoke).

## Product Decisions

- **Visibility / publishing:** Self-publish to a public gallery. Logged-in users
  upload and flip their own photos to `published`. Anyone — including
  logged-out visitors — can browse published photos. `published` is the
  uploader's own switch; admins only intervene for DMCA/abuse.
- **Conventions:** Admin-created only, shown in a public list. Users upload into
  whichever convention they attended.
- **Admin roles:** A single global admin role (site-wide). Any admin can manage
  all conventions, handle DMCA, and moderate any photo. (Per-convention
  moderators are a possible future extension, explicitly out of scope now.)
- **NSFW handling:** NSFW photos render blurred with a "contains sensitive
  content" overlay; click to reveal. Viewers also have a "show NSFW by default"
  preference. EXIF is stripped from public images (see EXIF handling).
- **EXIF / privacy:** Strip EXIF/GPS from all public derivatives. Retain the
  original EXIF in a **private** `.exif` sidecar (same base name) in S3, kept for
  later reference/legal needs. Never public.
- **Takedowns:** Soft-remove with an audit trail. Photo status flips to
  `TAKEN_DOWN` recording actor, timestamp, and reason; public derivatives are
  deleted; the private original + `.exif` sidecar are **retained** as evidence.
  Nothing is hard-deleted without a separate explicit step.
- **Reporting:** In-app "Report" button on every photo (available logged-out),
  feeding an admin moderation queue. Plus a dedicated `/dmca` page with a formal
  takedown-notice form. Both land in the same queue.
- **Tags:** Free-form, with autocomplete suggesting existing tags. Stored as
  normalized (lowercase) tag records with a many-to-many join for filter/browse.
- **Users:** Public `displayName` (seeded from OAuth profile, editable).
- **Photographer credit:** Optional per-photo free-text credit; falls back to the
  uploader's `displayName` when empty.
- **Uploads:** Dedicated `/upload` page. Multi-file selection — the client
  requests N presigned URLs in one batch call, uploads originals in parallel
  (concurrency-capped), and processes each as it lands. HEIC accepted as input
  (always transcoded to WebP for display).

## Data Model (Prisma)

- **User** — Auth.js fields (`id, name, email, emailVerified, image`) +
  `displayName`, `role: USER | ADMIN`.
- **Account / Session / VerificationToken** — standard Auth.js adapter tables.
- **Convention** — `id, slug (unique), name, description?, startDate?, endDate?,
  location?, bannerKey?, createdById, createdAt`.
- **Photo** — `id, conventionId, uploaderId, status (PENDING | READY |
  TAKEN_DOWN | FAILED), originalKey, webKey, thumbKey, exifKey, published
  (bool, default false), nsfw (bool, default false), description?,
  photographerCredit?, width, height, contentType, createdAt, updatedAt`, plus
  takedown fields `takenDownAt?, takenDownById?, takedownReason?`.
- **Tag** — `id, name (unique, normalized lowercase), createdAt`.
- **PhotoTag** — join table (`photoId, tagId`) for many-to-many.
- **Report** — `id, photoId, reporterUserId? (null = logged-out), category
  (ABUSE | COPYRIGHT | OTHER), message, contactEmail? (for DMCA), status (OPEN |
  RESOLVED | DISMISSED), createdAt, resolvedById?, resolvedAt?, resolutionNote?`.
- **AuditLog** — `id, actorId, photoId?, conventionId?, action, reason?,
  createdAt` — immutable trail behind soft-removes and other admin actions.

**Multi-tenancy:** single app/DB; conventions are a first-class row. Every photo
belongs to exactly one convention. Isolation is enforced at the query layer
(always scope by `conventionId`), not via separate databases.

## Upload & Processing Pipeline

1. Logged-in user picks a convention on `/upload` and selects one or more
   photos. Client calls `POST /api/uploads/presign` with per-file metadata
   (content-type, size). Server validates auth, content-type, and size cap;
   creates a `Photo` row per file with `status=PENDING`; returns an array of
   `{ photoId, presignedUrl }`.
2. Browser uploads each **original** directly to its private S3 key, in parallel
   with a concurrency cap.
3. As each upload finishes, the browser calls
   `POST /api/uploads/[photoId]/process`. Server reads the original and uses
   `sharp` to: extract EXIF → write the private `.exif` sidecar; strip all
   metadata; generate a `web` derivative (max ~2000px, tuned WebP) and a `thumb`
   (~400px WebP); record `width/height/contentType`; upload derivatives as
   public-read. Flips `status=READY`.
4. On failure, `status=FAILED`; the client offers per-file retry.

Shared metadata (convention, optional default tags/NSFW) can be applied across
the batch, with per-photo overrides after they land.

Accepted input types: JPEG, PNG, WebP, HEIC. Original size cap ~25MB, enforced
in the presign request and via S3 conditions.

### S3 Key Layout (single bucket)

```
conventions/{conventionId}/photos/{photoId}/original.<ext>   (private)
conventions/{conventionId}/photos/{photoId}/metadata.exif    (private)
conventions/{conventionId}/photos/{photoId}/web.webp         (public-read)
conventions/{conventionId}/photos/{photoId}/thumb.webp       (public-read)
```

Takedown deletes the public `web`/`thumb` objects and retains the private
`original` + `metadata.exif`.

## Pages & Flows

### Public (no login)
- `/` — landing: list of conventions (banner, name, dates, photo count).
- `/c/[slug]` — convention gallery: responsive grid of `published && READY`
  photos; filter by tag; NSFW blur/reveal + "show NSFW by default" preference;
  paginated/infinite scroll.
- `/c/[slug]/p/[photoId]` — single photo: full web-size image, description, tags,
  credit/uploader, report button.
- `/dmca` — formal takedown-notice form.
- Sign-in page.

### Logged-in user
- `/upload` — dedicated multi-file upload page (pick convention → batch flow).
- `/me` — one global view of all my uploads across conventions: edit
  description/tags/credit/NSFW, toggle `published`, delete my own photos, edit
  `displayName`.
- Report button on any photo (also available logged-out).

### Admin (role = ADMIN)
- `/admin` — dashboard.
- Conventions CRUD (create/edit, banner upload).
- Moderation queue (open reports → view photo, even if unpublished →
  soft-remove with reason, or dismiss).
- Photo/convention search; user promotion to admin.

## Auth & Authorization

- Auth.js v5, Google + GitHub. First login creates a `User` (role `USER`,
  `displayName` seeded from OAuth profile).
- **Admin bootstrapping:** `ADMIN_EMAILS` env var (comma-separated) grants admin
  on login; admins can also promote other users from `/admin`.
- **Rules:** uploading requires login; editing/deleting a photo requires being
  its uploader **or** an admin; `/admin/*` requires `role=ADMIN`, enforced in
  middleware **and** re-checked in each server action (never trust the client).

## Moderation Flow

Reports land as `OPEN`. An admin opens one, views the photo (including if
unpublished), then either:
- **Soft-removes:** `status → TAKEN_DOWN`; record `takenDownBy/At/reason`; delete
  public derivatives; write an `AuditLog` row; resolve linked reports. The photo
  then shows a tombstone and never the image.
- **Dismisses:** report `→ DISMISSED` with a note.

## Testing & Quality

Project rule: lint, type-check, tests, and build must all pass before any
commit; new features require unit tests.

- **Unit (Vitest):** EXIF strip/extract, S3 key generation, tag normalization,
  authorization helpers, presign validation.
- **Integration:** API routes / server actions against a test Postgres schema
  (Prisma), with S3 mocked via `aws-sdk-client-mock`.
- **E2E (Playwright) smoke:** sign-in stub → upload → publish → appears in
  gallery; report → admin takedown → tombstone.
- Pre-commit gate: ESLint + `tsc --noEmit` + `prisma validate`.

## Out of Scope (for launch)

- Per-convention moderators / organizer role tier.
- Async/queue-based image processing (synchronous route handler is sufficient at
  launch scale).
- Automated NSFW detection (manual flag only).
- Hard-delete UI (retained originals are the default; purge is a separate
  explicit action).
- CDN/CloudFront signed-URL optimization for images (public-read derivatives
  served directly for now).
