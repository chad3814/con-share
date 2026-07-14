import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/login?callbackUrl=/admin");

  return (
    <div className="space-y-6">
      <nav className="flex gap-4 border-b border-gray-200 pb-3 text-sm">
        <Link href="/admin" className="font-medium">Dashboard</Link>
        <Link href="/admin/conventions" className="font-medium">Conventions</Link>
      </nav>
      {children}
    </div>
  );
}
