import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="w-full rounded border border-border py-2 transition-colors hover:bg-muted active:bg-border">
          Continue with GitHub
        </button>
      </form>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="w-full rounded border border-border py-2 transition-colors hover:bg-muted active:bg-border">
          Continue with Google
        </button>
      </form>
    </section>
  );
}
