import type { Convention } from "@/generated/prisma/client";
import { toDateInputValue } from "@/lib/date";

export default function ConventionForm({
  action,
  convention,
  submitLabel,
  logoUrl,
}: {
  action: (formData: FormData) => void | Promise<void>;
  convention?: Convention;
  submitLabel: string;
  logoUrl?: string | null;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input name="name" required defaultValue={convention?.name ?? ""} className="mt-1 w-full rounded border border-border px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea name="description" defaultValue={convention?.description ?? ""} className="mt-1 w-full rounded border border-border px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Location</span>
        <input name="location" defaultValue={convention?.location ?? ""} className="mt-1 w-full rounded border border-border px-3 py-2" />
      </label>
      <div className="flex gap-4">
        <label className="block flex-1">
          <span className="text-sm font-medium">Start date</span>
          <input type="date" name="startDate" defaultValue={toDateInputValue(convention?.startDate)} className="mt-1 w-full rounded border border-border px-3 py-2" />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium">End date</span>
          <input type="date" name="endDate" defaultValue={toDateInputValue(convention?.endDate)} className="mt-1 w-full rounded border border-border px-3 py-2" />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Website URL (optional)</span>
        <input name="url" type="url" defaultValue={convention?.url ?? ""} className="mt-1 w-full rounded border border-border px-3 py-2" />
      </label>
      {logoUrl ? (
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="Current logo" className="h-16 w-16 rounded object-contain" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="removeLogo" />
            Remove logo
          </label>
        </div>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium">Logo (optional)</span>
        <input type="file" name="logo" accept="image/jpeg,image/png,image/webp" className="mt-1 w-full text-sm" />
      </label>
      <button type="submit" className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">{submitLabel}</button>
    </form>
  );
}
