import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Admin</h1>
      <ul className="list-inside list-disc text-gray-700">
        <li>
          <Link href="/admin/conventions" className="underline">Manage conventions</Link>
        </li>
      </ul>
    </section>
  );
}
