import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { env } from "@/env";

const createPrismaClient = () => {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof createPrismaClient>;

// eslint-disable-next-line no-restricted-syntax
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientSingleton };

// Lazily constructed: importing this module never builds a PrismaClient
// (which would read env vars and open a connection). The client is only
// created on first property access, then cached on the dev global.
function getPrismaClient(): PrismaClientSingleton {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClientSingleton, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClientSingleton];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
