import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js-style env loading: this project keeps secrets in `.env.local`
// (git-ignored) rather than `.env`, so `dotenv/config`'s default load is a
// no-op here. Load `.env.local` explicitly so the Prisma CLI (which runs
// outside the Next.js runtime) can resolve DIRECT_URL/DATABASE_URL.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
