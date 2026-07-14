import type { Role } from "@/generated/prisma/client";

/**
 * Pure authorization helpers with no dependency on `@/auth` or `prisma`.
 * Kept separate from `auth-helpers.ts` to avoid a circular import between
 * `src/auth.ts` (which needs `parseAdminEmails`) and `src/lib/auth-helpers.ts`
 * (which needs `auth` from `src/auth.ts`).
 */

export function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdmin(user: { role: Role } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
