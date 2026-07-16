# Multi-theme system with semantic tokens

**Date:** 2026-07-16
**Status:** Approved design, pending implementation plan

## Problem

The site has two competing color systems that produce unreadable text:

- `src/app/globals.css` makes the page background theme-adaptive: a
  `@media (prefers-color-scheme: dark)` block flips `--background` to
  `#0a0a0a` and `--foreground` to `#ededed`.
- Every component hardcodes light-mode-only Tailwind colors
  (`text-gray-500`, `text-gray-600`, `bg-white`, `border-gray-300`, etc.)
  with **no `dark:` variants anywhere** in the codebase.

On a dark-mode OS the page background goes near-black while dark-grey text
stays dark grey (dark-grey-on-black), and `text-white` (used 11×) lands on
light/white surfaces (white-on-white). 24 component files use hardcoded
`gray`/`white`/`black` utilities.

## Goals

- Replace hardcoded colors with a semantic token system so every surface and
  text color is defined per theme and always meets WCAG AA (≥4.5:1 body text).
- Ship five selectable themes: **Light, Dark, Indigo, Teal, Amber**.
- Default to the OS setting (System → Light or Dark), with a header dropdown to
  override, persisted across reloads with no flash of the wrong theme.

## Non-goals (future specs)

Typography, spacing, layout restructuring, and any component redesign beyond
color tokens.

## Design

### 1. Semantic token model

Every theme defines the same set of semantic CSS variables. They are mapped
into Tailwind v4 via `@theme inline` (`--color-*`) so utility classes resolve
to them.

| Token | Utility | Replaces |
|---|---|---|
| `background` / `foreground` | `bg-background` / `text-foreground` | `bg-white`, `text-gray-900` |
| `card` / `card-foreground` | `bg-card` / `text-card-foreground` | `bg-white` (elevated surfaces) |
| `muted` / `muted-foreground` | `bg-muted` / `text-muted-foreground` | `bg-gray-50/100`, `text-gray-400/500/600` |
| `border` | `border-border` | `border-gray-200/300/400` |
| `primary` / `primary-foreground` | `bg-primary` / `text-primary-foreground` | `bg-gray-900`/`bg-black` + `text-white` |
| `accent` / `accent-foreground` | `text-accent` / `bg-accent` / `text-accent-foreground` | links, highlights |
| `ring` | `ring-ring` | focus states |
| `destructive` / `destructive-foreground` | `bg-destructive` / `text-destructive-foreground` | takedown / DMCA / delete actions |

### 2. Migration mapping (old → new)

- `bg-white` (page) → `bg-background`; `bg-white` (cards/panels) → `bg-card`
- `text-gray-900` / `text-gray-800` / `text-gray-700` → `text-foreground`
- `text-gray-400` / `text-gray-500` / `text-gray-600` → `text-muted-foreground`
- `border-gray-200` / `border-gray-300` / `border-gray-400` → `border-border`
- `bg-gray-900` / `bg-black` (buttons) → `bg-primary`
- `text-white` on a primary button → `text-primary-foreground`
- `bg-gray-50` / `bg-gray-100` (subtle fills) → `bg-muted`
- destructive actions (takedown/DMCA/delete) → `bg-destructive text-destructive-foreground`
- links keep `underline`; add `text-accent` where a link should read as branded

Judgement is applied per site: a `bg-white` that is the page vs. a card is
mapped accordingly.

### 3. The five themes

Starting palettes below. Exact values are finalized during implementation and
each theme is verified against WCAG AA (≥4.5:1 for body text; ≥3:1 for large
text and UI borders/focus). Values live in `globals.css`: `:root` holds the
light palette, and `[data-theme="dark|indigo|teal|amber"]` blocks override.
A redundant `[data-theme="light"]` block reaffirms light because next-themes
always sets the attribute explicitly.

**Light** (neutral)
- background `#ffffff`, foreground `#171717`
- card `#ffffff`, card-foreground `#171717`
- muted `#f5f5f5`, muted-foreground `#525252`
- border `#e5e5e5`
- primary `#171717`, primary-foreground `#fafafa`
- accent `#4f46e5`, accent-foreground `#ffffff`
- ring `#4f46e5`
- destructive `#dc2626`, destructive-foreground `#ffffff`

**Dark** (neutral)
- background `#0a0a0a`, foreground `#ededed`
- card `#171717`, card-foreground `#ededed`
- muted `#262626`, muted-foreground `#a3a3a3`
- border `#262626`
- primary `#ededed`, primary-foreground `#0a0a0a`
- accent `#818cf8`, accent-foreground `#0a0a0a`
- ring `#818cf8`
- destructive `#ef4444`, destructive-foreground `#0a0a0a`

**Indigo** (dark slate, violet accent)
- background `#1e1b2e`, foreground `#ede9fe`
- card `#2a2540`, card-foreground `#ede9fe`
- muted `#3a3357`, muted-foreground `#c4b5fd`
- border `#3f3a5c`
- primary `#7c3aed`, primary-foreground `#ffffff`
- accent `#a78bfa`, accent-foreground `#1e1b2e`
- ring `#a78bfa`
- destructive `#f87171`, destructive-foreground `#1e1b2e`

**Teal** (cool light, teal accent)
- background `#f0fdfa`, foreground `#0f172a`
- card `#ffffff`, card-foreground `#0f172a`
- muted `#e6f7f4`, muted-foreground `#475569`
- border `#cbd5e1`
- primary `#0d9488`, primary-foreground `#ffffff`
- accent `#0d9488`, accent-foreground `#ffffff`
- ring `#0d9488`
- destructive `#dc2626`, destructive-foreground `#ffffff`

**Amber** (warm paper light, amber accent)
- background `#fffbf5`, foreground `#1c1917`
- card `#fffef9`, card-foreground `#1c1917`
- muted `#f5ede0`, muted-foreground `#78716c`
- border `#ecdfce`
- primary `#b45309`, primary-foreground `#fffbf5`
- accent `#b45309`, accent-foreground `#fffbf5`
- ring `#d97706`
- destructive `#dc2626`, destructive-foreground `#ffffff`

### 4. Theme mechanism (next-themes)

- Add dependency `next-themes@^0.4` (App Router + React 19 compatible).
- New client component `src/components/ThemeProvider.tsx` wrapping
  `next-themes`' provider with:
  - `attribute="data-theme"`
  - `defaultTheme="system"`
  - `enableSystem`
  - `themes={["light", "dark", "indigo", "teal", "amber"]}`
- `src/app/layout.tsx`:
  - `<html lang="en" suppressHydrationWarning>`
  - body: `bg-white text-gray-900` → `bg-background text-foreground`
  - wrap `<Header />` + `<main>` in `<ThemeProvider>`
- next-themes injects its own no-flash inline script; the
  `@media (prefers-color-scheme: dark)` block is removed from `globals.css`
  (System resolution is handled by next-themes via `data-theme`).

### 5. Header dropdown — `src/components/ThemeSelect.tsx` (client)

- Native accessible `<select>` (label associated for a11y) with options
  **System / Light / Dark / Indigo / Teal / Amber**.
- Driven by `useTheme()` from next-themes: value = `theme`, change →
  `setTheme(value)`.
- Standard `mounted` guard: render a stable placeholder until mounted to avoid
  a hydration mismatch (next-themes cannot know the resolved theme on the
  server).
- Rendered by `Header` (which stays an async server component) between the
  brand link and the auth section.

### 6. Component migration

Rewrite the 24 files below from hardcoded `gray`/`white`/`black` utilities to
the semantic utilities per the migration mapping, one file at a time:

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/login/page.tsx`
- `src/app/upload/page.tsx`, `src/app/upload/Uploader.tsx`
- `src/app/me/page.tsx`, `src/app/me/MyPhotos.tsx`
- `src/app/dmca/page.tsx`, `src/app/dmca/DmcaForm.tsx`
- `src/app/c/[slug]/page.tsx`
- `src/app/c/[slug]/p/[photoId]/page.tsx`,
  `src/app/c/[slug]/p/[photoId]/PhotoView.tsx`,
  `src/app/c/[slug]/p/[photoId]/ReportForm.tsx`
- `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`,
  `src/app/admin/reports/page.tsx`,
  `src/app/admin/conventions/page.tsx`,
  `src/app/admin/conventions/ConventionForm.tsx`
- `src/components/Header.tsx`, `src/components/ConventionCard.tsx`,
  `src/components/NsfwToggle.tsx`, `src/components/PhotoGrid.tsx`,
  `src/components/PhotoThumb.tsx`, `src/components/TagInput.tsx`

### 7. Testing

- Unit tests (Vitest + Testing Library) for `ThemeSelect`, mocking
  next-themes' `useTheme`:
  - renders all six options (System, Light, Dark, Indigo, Teal, Amber)
  - selecting an option calls `setTheme` with the matching value
  - reflects the current theme as the selected value
  - renders a stable placeholder before `mounted`
- Token-completeness test: parse `globals.css` and assert every theme block
  (`:root` and each `[data-theme=...]`) defines the full token set, so a theme
  can never ship missing a variable (which would produce unreadable output).
- Full `npm run check` (lint, typecheck, tests, build) must pass before commit,
  per project rules.

## Risks / trade-offs

- **next-themes dependency:** adds a small dependency, but replaces hand-rolled
  no-flash/persistence/system code that would otherwise need its own tests.
- **Hydration:** the `mounted` guard means the dropdown shows a placeholder for
  one client tick; acceptable and standard.
- **Palette tuning:** starting hex values may shift slightly during
  implementation to satisfy AA contrast; the token names and structure are
  fixed.
