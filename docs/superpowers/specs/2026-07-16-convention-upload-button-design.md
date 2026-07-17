# Inline upload on the convention page

**Date:** 2026-07-16
**Status:** Approved design, pending implementation plan

## Problem

When a signed-in user is browsing a convention gallery (`/c/[slug]`), there is
no way to add photos from that page — they must navigate to `/upload` and
re-select the convention they were already viewing. We want an upload
affordance directly on the convention page, scoped to that convention.

## Goals

- Show an **"Upload photos"** button on the convention page **only when a user
  is signed in**.
- Clicking it reveals an inline uploader **locked to the current convention**
  (no convention picker).
- Reuse the existing upload pipeline (presign + process) and the existing
  `Uploader` component; no API changes.

## Non-goals

- No changes to moderation, publishing, or the upload API routes.
- No auto-refresh of the gallery after upload (see Trade-offs).
- The standalone `/upload` page keeps its current behavior (convention picker).

## Design

### 1. Convention page — `src/app/c/[slug]/page.tsx`

Remains a public server component (no `requireUser`). Add
`getCurrentUser()`; when a user is present, render a new client component in
the header area (near `NsfwToggle`), above the `PhotoGrid`:

```tsx
{user ? (
  <ConventionUploadPanel
    conventionId={convention.id}
    conventionName={convention.name}
  />
) : null}
```

Signed-out users never receive the panel (server-gated), so the upload UI is
never shown to them.

### 2. New client component — `src/components/ConventionUploadPanel.tsx`

- Renders an **"Upload photos"** button styled with semantic tokens
  (`bg-primary text-primary-foreground`).
- Holds a `useState` boolean `open`. When `open`, renders
  `<Uploader fixedConventionId={conventionId} />` inside a bordered card
  (`border-border`, `bg-card`) below the button, and the button label flips to
  **"Hide uploader"**.
- Props: `{ conventionId: string; conventionName?: string }`.

### 3. `Uploader.tsx` — add a locked mode

- Props become `{ conventions?: ConventionOption[]; fixedConventionId?: string }`.
- Initialize `conventionId` as `fixedConventionId ?? conventions?.[0]?.id ?? ""`.
- Render the convention `<select>` **only** in picker mode
  (`!fixedConventionId`). In locked mode the picker is omitted and uploads go
  to `fixedConventionId`.
- All other behavior (file selection, presign, upload, process, per-file
  retry) is unchanged.
- `src/app/upload/page.tsx` continues to pass `conventions` — picker mode,
  unchanged.

### 4. Upload pipeline reuse

The inline uploader posts to the existing `/api/uploads/presign` and
`/api/uploads/[photoId]/process` routes, which already enforce authentication.
No new endpoints or auth logic.

## Testing

- **`ConventionUploadPanel`** (Vitest + Testing Library): the uploader is
  hidden initially; clicking the button reveals it and flips the label;
  clicking again hides it. The fixed convention id is passed through to
  `Uploader` (mock `Uploader` to assert the prop).
- **`Uploader` locked mode**: given `fixedConventionId`, no convention
  `<select>` is rendered; given `conventions` and no `fixedConventionId`, the
  picker still renders (guards against regressing `/upload`).
- New components use semantic color tokens; the existing
  `no-hardcoded-colors` guard test enforces this.

## Trade-offs

- **No gallery auto-refresh:** the gallery is server-rendered, so a
  freshly-uploaded photo will not appear until the page is refreshed (and,
  per the moderation/publish flow, after it is published). MVP accepts this;
  a `router.refresh()` on batch completion is a possible follow-up.
- **Adding a locked mode to `Uploader`** keeps a single upload component
  rather than forking a second one — slightly more conditional logic in
  `Uploader`, but avoids duplication of the upload pipeline.
