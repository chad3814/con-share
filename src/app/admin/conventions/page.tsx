import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminConventionsPage() {
  const conventions = await prisma.convention.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Conventions</h1>
        <Link href="/admin/conventions/new" className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
          New convention
        </Link>
      </div>
      {conventions.length === 0 ? (
        <p className="text-gray-500">No conventions yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
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
