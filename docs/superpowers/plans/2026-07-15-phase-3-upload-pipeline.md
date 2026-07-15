# Phase 3 — Upload & Processing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logged-in users can select multiple photos on `/upload`, which are uploaded to S3 as private originals, processed server-side (EXIF stripped to a private `.exif` sidecar; public-read web + thumbnail WebP derivatives generated), and recorded as `Photo` rows. Uploads land `published=false`; the uploader sees their processed results on `/upload`.

**Architecture:** Browser requests a batch of presigned S3 `PUT` URLs from `/api/uploads/presign` (one `Photo` row per file, `status=PENDING`). It uploads each original directly to a private key, then calls `/api/uploads/[photoId]/process`, which streams the original from S3, uses `sharp` to extract+strip EXIF and produce derivatives, uploads the sidecar (private) + web/thumb (public-read), and flips the row to `READY`. Failures set `FAILED`.

**Tech Stack:** Phase 1/2 stack + `sharp` 0.35, `@aws-sdk/client-s3` 3.x, `@aws-sdk/s3-request-presigner` 3.x.

## Global Constraints

- **Code style:** 2-space indent; semicolons. No `any`/`unknown` (ESLint-enforced; only sanctioned exception is `src/lib/prisma.ts`).
- **Commits require Chad's explicit approval**; commit only if `npm run check` passes. Never push. Never Read `.env.local`.
- **Auth:** uploading requires a logged-in user (`requireUser`); the process route requires the caller to be the photo's uploader (or admin). Server-side enforced, never trust the client.
- **Uploads land `published=false`** (publish toggle is Phase 4). NSFW handling/UI is Phase 4 — photos default `nsfw=false` and render plainly here.
- **S3 key layout (exact):**
  ```
  conventions/{conventionId}/photos/{photoId}/original.<ext>   (private)
  conventions/{conventionId}/photos/{photoId}/metadata.exif    (private)
  conventions/{conventionId}/photos/{photoId}/web.webp         (public-read)
  conventions/{conventionId}/photos/{photoId}/thumb.webp       (public-read)
  ```
- **Accepted input types:** `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`. Derivatives are always WebP. **Original size cap: 25 MB**, enforced in the presign request and via a presigned-PUT content-length condition.
- **Derivative sizes:** web = max 2000px on the long edge (WebP, quality ~82); thumb = max 400px (WebP, quality ~75). Never upscale.
- **EXIF:** the original's EXIF is extracted to the private `metadata.exif` sidecar; ALL metadata is stripped from the public derivatives.
- **S3 INFRA DEPENDENCY (confirm before Tasks 4–6):** for public-read serving of `web.webp`/`thumb.webp` via direct URL, the bucket must (a) allow browser presigned `PUT` (CORS: allow `PUT` from the app origin) and (b) serve the derivative keys publicly — via a **bucket policy** granting `s3:GetObject` on `conventions/*/photos/*/web.webp` and `.../thumb.webp` with Block-Public-Access adjusted to permit it. Modern buckets have ACLs disabled, so the code does NOT set `ACL: public-read`; public read comes from the bucket policy. Confirm this bucket config with Chad at Task 5.
- Testing strategy: unit-test the pure/near-pure logic — S3 key building, image processing (real fixture via `sharp`), upload validation. Route + full-upload E2E need auth + live S3 and are verified by **manual smoke** + build/typecheck (automated integration deferred, consistent with Phase 2).

---

## File Structure (end of Phase 3)

```
src/lib/
├─ s3.ts                       # S3 client, key builders, put/get/delete/presign, publicUrl  + s3.test.ts (key builders)
├─ image.ts                    # sharp: processImage() → { web, thumb, exif, width, height } + image.test.ts (fixture)
└─ validation/upload.ts        # presign request schema + accepted types/size  + upload.test.ts
src/app/
├─ api/uploads/
│  ├─ presign/route.ts         # POST: requireUser, create Photo rows, return presigned PUTs
│  └─ [photoId]/process/route.ts  # POST: process original → derivatives + sidecar, mark READY
└─ upload/
   ├─ page.tsx                 # server: requireUser + convention list, renders the client uploader
   └─ Uploader.tsx             # client: multi-file batch upload + per-file progress + preview
src/components/PhotoGrid.tsx    # updated: render real thumb images via public URL
src/lib/conventions.ts          # + getPublishedPhotos(conventionId) for the gallery (READY+published)
```

---

### Task 1: S3 client + key layout module

**Files:** Create `src/lib/s3.ts`, `src/lib/s3.test.ts`.

**Interfaces (Produces):**
- `photoKeys(conventionId: string, photoId: string, originalExt: string): { original: string; exif: string; web: string; thumb: string }` — pure.
- `extForContentType(contentType: string): string` — pure (`image/jpeg`→`jpg`, `png`→`png`, `webp`→`webp`, `heic`→`heic`, `heif`→`heif`).
- `s3` — configured `S3Client`.
- `presignPut(key: string, contentType: string, maxBytes: number): Promise<string>`.
- `putObject(key, body: Buffer, contentType: string): Promise<void>` (private).
- `getObjectBytes(key: string): Promise<Buffer>`.
- `deleteObjects(keys: string[]): Promise<void>`.
- `publicUrl(key: string): string` — `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`.

- [ ] **Step 1: Install deps** — `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] **Step 2: Write failing tests** (`src/lib/s3.test.ts`) for the PURE builders only (no network):

```ts
import { photoKeys, extForContentType, publicUrl } from "@/lib/s3";

describe("photoKeys", () => {
  it("builds the four keys under the convention/photo prefix", () => {
    const k = photoKeys("con1", "ph1", "jpg");
    expect(k.original).toBe("conventions/con1/photos/ph1/original.jpg");
    expect(k.exif).toBe("conventions/con1/photos/ph1/metadata.exif");
    expect(k.web).toBe("conventions/con1/photos/ph1/web.webp");
    expect(k.thumb).toBe("conventions/con1/photos/ph1/thumb.webp");
  });
});

describe("extForContentType", () => {
  it("maps accepted content types", () => {
    expect(extForContentType("image/jpeg")).toBe("jpg");
    expect(extForContentType("image/heic")).toBe("heic");
  });
  it("throws on unsupported types", () => {
    expect(() => extForContentType("image/gif")).toThrow();
  });
});

describe("publicUrl", () => {
  it("builds a virtual-hosted-style URL", () => {
    expect(publicUrl("conventions/c/photos/p/web.webp")).toMatch(
      /^https:\/\/.+\.s3\..+\.amazonaws\.com\/conventions\/c\/photos\/p\/web\.webp$/,
    );
  });
});
```

- [ ] **Step 3: Run — RED** (`npm run test -- src/lib/s3.test.ts`; module missing).
- [ ] **Step 4: Implement `src/lib/s3.ts`:**

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";

export const s3 = new S3Client({
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extForContentType(contentType: string): string {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) throw new Error(`Unsupported content type: ${contentType}`);
  return ext;
}

export function photoKeys(conventionId: string, photoId: string, originalExt: string) {
  const base = `conventions/${conventionId}/photos/${photoId}`;
  return {
    original: `${base}/original.${originalExt}`,
    exif: `${base}/metadata.exif`,
    web: `${base}/web.webp`,
    thumb: `${base}/thumb.webp`,
  };
}

export function publicUrl(key: string): string {
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

export async function presignPut(key: string, contentType: string, maxBytes: number): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: maxBytes,
  });
  return getSignedUrl(s3, command, { expiresIn: 600 });
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
```

> Note on `ContentLength` in the presign: it binds the signed PUT to an exact size. If the browser can't send an exact length ahead of time, relax to a post-condition or drop it and rely on the DB-side cap + a max-size check; note whichever you use. The `res.Body!` non-null uses `!`, not `any`/`unknown` — acceptable.

- [ ] **Step 5: Run — GREEN.** `npm run test -- src/lib/s3.test.ts`, then `npm run typecheck && npm run lint`.
- [ ] **Step 6: Commit** (verify + ask): `feat: add S3 client and key layout helpers`.

---

### Task 2: Image processing module (sharp)

**Files:** Create `src/lib/image.ts`, `src/lib/image.test.ts`.

**Interfaces (Produces):**
- `processImage(input: Buffer): Promise<{ web: Buffer; thumb: Buffer; exif: Buffer | null; width: number; height: number }>` — decodes any accepted format (incl. HEIC), extracts the original EXIF buffer (or null), and returns metadata-stripped WebP `web` (≤2000px) + `thumb` (≤400px), plus the original pixel dimensions.

- [ ] **Step 1: Install sharp** — `npm install sharp`
- [ ] **Step 2: Write the failing test** (`src/lib/image.test.ts`) using a `sharp`-generated fixture with embedded EXIF:

```ts
import sharp from "sharp";
import { processImage } from "@/lib/image";

async function fixtureWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .withExif({ IFD0: { Copyright: "Chad", Make: "TestCam" } })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("extracts EXIF, strips it from derivatives, and resizes", async () => {
    const input = await fixtureWithExif();
    const result = await processImage(input);

    expect(result.width).toBe(3000);
    expect(result.height).toBe(2000);
    expect(result.exif).not.toBeNull();
    expect(result.exif!.length).toBeGreaterThan(0);

    const webMeta = await sharp(result.web).metadata();
    expect(webMeta.format).toBe("webp");
    expect(webMeta.width).toBeLessThanOrEqual(2000);
    expect(webMeta.exif).toBeUndefined(); // stripped

    const thumbMeta = await sharp(result.thumb).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.exif).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run — RED.**
- [ ] **Step 4: Implement `src/lib/image.ts`:**

```ts
import sharp from "sharp";

const WEB_MAX = 2000;
const THUMB_MAX = 400;

export async function processImage(input: Buffer): Promise<{
  web: Buffer;
  thumb: Buffer;
  exif: Buffer | null;
  width: number;
  height: number;
}> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const exif = meta.exif ?? null;

  const web = await sharp(input)
    .rotate() // apply EXIF orientation before stripping
    .resize({ width: WEB_MAX, height: WEB_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(input)
    .rotate()
    .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  return { web, thumb, exif, width, height };
}
```

> `sharp` strips metadata by default (unless `.withMetadata()` is called), so the derivatives are EXIF-free. `.rotate()` with no args bakes in EXIF orientation so stripping doesn't flip portrait photos.
> **HEIC risk:** verify the installed `sharp` prebuilt decodes HEIC/HEIF in this environment. Add a second test that feeds a HEIC buffer if you can produce one; if `sharp` cannot decode HEIC here, STOP and report BLOCKED (do not silently drop HEIC support — the spec requires accepting it). Document the finding.

- [ ] **Step 5: Run — GREEN.** Then `npm run typecheck && npm run lint`.
- [ ] **Step 6: Commit** (verify + ask): `feat: add sharp image processing (EXIF extract/strip + web/thumb)`.

---

### Task 3: Upload request validation

**Files:** Create `src/lib/validation/upload.ts`, `src/lib/validation/upload.test.ts`.

**Interfaces (Produces):**
- `ACCEPTED_TYPES: readonly string[]`, `MAX_UPLOAD_BYTES = 25 * 1024 * 1024`.
- `presignRequestSchema` (zod): `{ conventionId: string; files: { contentType: string; size: number }[] }` — `files` non-empty, ≤ some batch cap (e.g. 25), each `contentType` in `ACCEPTED_TYPES`, each `size` > 0 and ≤ `MAX_UPLOAD_BYTES`.
- `type PresignRequest = z.infer<...>`; `parsePresignRequest(raw: unknown→ use the typed input)`.

> No-`unknown`: type the parser input as `PresignRequest` candidate via `z.infer` and call `.parse` on the parsed JSON typed as `object`. Use `parsePresignRequest(raw: object): PresignRequest` (JSON body is an object). No `any`/`unknown`.

- [ ] **Step 1: Failing tests** (`upload.test.ts`): accepts a valid single/multi-file request; rejects an unsupported content type; rejects a file over 25MB; rejects an empty `files` array. (Write concrete cases mirroring Task 3 of Phases past.)
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement** the zod schema + constants + `parsePresignRequest`.
- [ ] **Step 4: GREEN + typecheck + lint.**
- [ ] **Step 5: Commit** (verify + ask): `feat: add upload request validation`.

*(Complete test cases + schema code to be written verbatim in the task brief at execution time; mirror the Phase 2 validation task's structure — name the exact assertions, no placeholders.)*

---

### Task 4: Presign API route

**Files:** Create `src/app/api/uploads/presign/route.ts`.

**Interfaces:** `POST /api/uploads/presign` — body `{ conventionId, files: [{contentType,size}] }` → `{ uploads: [{ photoId, key, url }] }`.
- Consumes: `requireUser`, `parsePresignRequest`, `prisma`, `photoKeys`/`extForContentType`/`presignPut`, `MAX_UPLOAD_BYTES`.

- [ ] **Step 1: Implement the route:**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { parsePresignRequest, MAX_UPLOAD_BYTES } from "@/lib/validation/upload";
import { photoKeys, extForContentType, presignPut } from "@/lib/s3";

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();
  const body = await request.json();
  const { conventionId, files } = parsePresignRequest(body);

  const convention = await prisma.convention.findUnique({ where: { id: conventionId }, select: { id: true } });
  if (!convention) return NextResponse.json({ error: "Convention not found" }, { status: 404 });

  const uploads = [];
  for (const file of files) {
    const ext = extForContentType(file.contentType);
    const photo = await prisma.photo.create({
      data: {
        conventionId,
        uploaderId: user.id,
        status: "PENDING",
        originalKey: "", // set below once we know the id
        contentType: file.contentType,
      },
    });
    const keys = photoKeys(conventionId, photo.id, ext);
    await prisma.photo.update({ where: { id: photo.id }, data: { originalKey: keys.original } });
    const url = await presignPut(keys.original, file.contentType, MAX_UPLOAD_BYTES);
    uploads.push({ photoId: photo.id, key: keys.original, url });
  }

  return NextResponse.json({ uploads });
}
```

> `requireUser` throws `AuthError` for anonymous callers — wrap-free is fine (Next surfaces it as a 500/handled error); if you want a clean 401, catch `AuthError` and return `NextResponse.json({error}, {status:401})`. Do that.
- [ ] **Step 2: Build + typecheck + lint.** (Route needs no live S3 to build.)
- [ ] **Step 3: Confirm S3 bucket config with Chad** (CORS for presigned PUT from the dev origin). Pause here if unconfirmed.
- [ ] **Step 4: Commit** (verify + ask): `feat: add batch presign upload route`.

---

### Task 5: Process API route

**Files:** Create `src/app/api/uploads/[photoId]/process/route.ts`.

**Interfaces:** `POST /api/uploads/[photoId]/process` → reads the original, processes, uploads sidecar + derivatives (public per bucket policy), sets `Photo.status=READY` with `webKey/thumbKey/exifKey/width/height`. On error → `FAILED`.
- Consumes: `requireUser`, `prisma`, `getObjectBytes`/`putObject`/`photoKeys`, `processImage`.

- [ ] **Step 1: Implement** (auth: caller must be the uploader or admin; Next 16 async `params`):

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getObjectBytes, putObject } from "@/lib/s3";
import { processImage } from "@/lib/image";

export async function POST(_request: Request, { params }: { params: Promise<{ photoId: string }> }): Promise<Response> {
  const user = await requireUser();
  const { photoId } = await params;
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (photo.uploaderId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const base = photo.originalKey.replace(/\/original\.[^/]+$/, "");
  const webKey = `${base}/web.webp`;
  const thumbKey = `${base}/thumb.webp`;
  const exifKey = `${base}/metadata.exif`;
  try {
    const original = await getObjectBytes(photo.originalKey);
    const { web, thumb, exif, width, height } = await processImage(original);
    await putObject(webKey, web, "image/webp");
    await putObject(thumbKey, thumb, "image/webp");
    if (exif) await putObject(exifKey, exif, "application/octet-stream");
    const updated = await prisma.photo.update({
      where: { id: photo.id },
      data: { status: "READY", webKey, thumbKey, exifKey: exif ? exifKey : null, width, height },
    });
    return NextResponse.json({ status: updated.status });
  } catch (error) {
    await prisma.photo.update({ where: { id: photo.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
```

> Wrap `requireUser`'s `AuthError` to a 401 as in Task 4. `putObject` does NOT set an ACL — public read of `web`/`thumb` comes from the bucket policy (Global Constraints). Verify with Chad that the bucket policy makes these keys publicly readable; if not, this task's derivatives won't load in the browser even though the row is READY.
- [ ] **Step 2: Build + typecheck + lint.**
- [ ] **Step 3: Commit** (verify + ask): `feat: add image process route (derivatives + sidecar)`.

---

### Task 6: Upload UI (`/upload`)

**Files:** Create `src/app/upload/page.tsx` (server), `src/app/upload/Uploader.tsx` (client).

**Interfaces:** `/upload` — `requireUser` (proxy already gates it); server loads the convention list and renders `<Uploader conventions={...} />`. The client: pick a convention, select multiple files, `POST /api/uploads/presign`, `PUT` each original to its presigned URL (concurrency cap ~3), then `POST .../process`, tracking per-file state `pending → uploading → processing → ready | failed` with a retry, and previews `web` images (via `publicUrl`) on success.

- [ ] **Step 1: `page.tsx`** — server component: `requireUser()`, `prisma.convention.findMany` (id, name), render `<Uploader conventions={...} />`. Empty state if no conventions.
- [ ] **Step 2: `Uploader.tsx`** — `"use client"`; the batch flow above with a concurrency-capped runner and per-file progress UI (mobile-first). Full component code written verbatim in the task brief at execution.
- [ ] **Step 3: Build + typecheck + lint.**
- [ ] **Step 4: Manual smoke** (documented) — log in, `/upload`, select 2 photos incl. one with GPS EXIF, upload; confirm both go `ready`, the preview shows the resized image, and in S3 the `original`/`metadata.exif` are private while `web`/`thumb` load via public URL and carry no EXIF.
- [ ] **Step 5: Commit** (verify + ask): `feat: add /upload batch uploader UI`.

---

### Task 7: Render real images (PhotoGrid + gallery data)

**Files:** Modify `src/components/PhotoGrid.tsx`; add `getPublishedPhotos` to `src/lib/conventions.ts`; wire `src/app/c/[slug]/page.tsx`.

- [ ] **Step 1: Add `getPublishedPhotos(conventionId: string): Promise<GalleryPhoto[]>`** to `conventions.ts` — `prisma.photo.findMany({ where: { conventionId, published: true, status: "READY" }, orderBy: { createdAt: "desc" }, select: { id, webKey, thumbKey, nsfw, description } })`.
- [ ] **Step 2: Update `PhotoGrid.tsx`** to render each photo's `thumbKey` via `publicUrl` in an `<img>` (mobile-first grid, `loading="lazy"`, `alt` from description). Keep the empty state. (NSFW blur stays Phase 4 — render plainly, but leave a `// Phase 4: NSFW blur` marker.)
- [ ] **Step 3: Wire the gallery** — `c/[slug]/page.tsx` passes `await getPublishedPhotos(convention.id)` to `PhotoGrid` (was `[]`). Public gallery stays empty in practice (uploads are `published=false`) until Phase 4, but the rendering path is now real.
- [ ] **Step 4: Update/keep `PhotoGrid.test.tsx`** — empty-state test still passes; add a case rendering one photo and asserting an `<img>` with the expected `src` + `alt`.
- [ ] **Step 5: test + typecheck + lint + build.**
- [ ] **Step 6: Commit** (verify + ask): `feat: render real photo thumbnails in the gallery grid`.

---

### Task 8: Wrap — full check + smoke doc

- [ ] **Step 1:** `npm run check` passes end-to-end.
- [ ] **Step 2:** `npm run test:e2e` — existing 3 pass (no new E2E; full upload E2E needs auth+S3, deferred — note it in the report).
- [ ] **Step 3:** Update the Phase 3 report with the manual-smoke checklist results (if Chad ran it).
- [ ] **Step 4: Commit** any remaining docs (verify + ask).

---

## Self-Review

**Spec coverage (Phase-3 slice):** batch presigned upload of originals (Task 4) ✅; server-side `sharp` processing — EXIF→private sidecar, strip, web+thumb WebP (Tasks 2, 5) ✅; S3 key layout + private originals/sidecar + public-read derivatives (Tasks 1, 5, Global Constraints) ✅; HEIC accepted (Tasks 1–2, with a BLOCKED gate if `sharp` can't decode) ✅; 25 MB cap + accepted types (Task 3) ✅; `/upload` multi-file UI with per-file progress + preview (Task 6) ✅; uploads `published=false`, uploader preview, gallery rendering path real (Tasks 6, 7) ✅; auth (uploader/admin only) (Tasks 4, 5) ✅.

**Deferred:** publish toggle, NSFW blur, tags, `/me`, photographer-credit editing → Phase 4. Reporting/moderation/takedown-delete → Phase 5. Automated route/upload E2E → pending auth+S3 test harness.

**Risks flagged in-plan:** (1) HEIC decode support in `sharp` — hard BLOCKED gate, not silent. (2) S3 public-read via bucket policy (not ACL) + CORS for presigned PUT — explicit Chad-confirm at Tasks 4–5. (3) presign `ContentLength` binding — noted fallback. (4) `res.Body!` non-null assertion — allowed (not `any`/`unknown`).

**No placeholders** except Tasks 3 and 6, which explicitly defer verbatim code (test cases / client component) to their execution-time task briefs — flagged as such, to be filled with concrete code (no "TODO") when those briefs are generated.

**Type consistency:** `photoKeys`/`publicUrl`/`extForContentType` (Task 1) consumed in Tasks 4/5/7; `processImage` shape (Task 2) consumed in Task 5; `PresignRequest`/`MAX_UPLOAD_BYTES` (Task 3) in Task 4; `GalleryPhoto` (existing) extended-in-place in Task 7.
