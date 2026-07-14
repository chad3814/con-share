import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { signOut } from "@/auth";

export default async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          Con-Share
        </Link>
        {user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="flex items-center gap-3"
          >
            <span className="text-sm text-gray-600">{user.name ?? "Signed in"}</span>
            <button type="submit" className="text-sm font-medium underline">
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/login" className="text-sm font-medium underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
