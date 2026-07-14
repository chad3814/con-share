import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { env } from "@/env";
import { parseAdminEmails } from "@/lib/authz";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [GitHub, Google],
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role ?? "USER";
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
      const isUserAdmin = !!user.email && adminEmails.includes(user.email.toLowerCase());
      await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: user.name ?? null,
          role: isUserAdmin ? "ADMIN" : "USER",
        },
      });
    },
    async signIn({ user }) {
      if (!user.email || !user.id) return;
      const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
      if (adminEmails.includes(user.email.toLowerCase())) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
