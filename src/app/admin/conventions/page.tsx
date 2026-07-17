import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminConventionsPage() {
  const conventions = await prisma.convention.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Conventions</h1>
        <Link href="/admin/conventions/new" className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80">
          New convention
        </Link>
      </div>
      {conventions.length === 0 ? (
        <p className="text-muted-foreground">No conventions yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {conventions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <span>{c.name}</span>
              <Link href={`/admin/conventions/${c.id}/edit`} className="text-sm underline">Edit</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
