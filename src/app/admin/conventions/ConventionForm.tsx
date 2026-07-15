import type { Convention } from "@/generated/prisma/client";
import { toDateInputValue } from "@/lib/date";

export default function ConventionForm({
  action,
  convention,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  convention?: Convention;
  submitLabel: string;
}) {
  return (
    <form action={action} className="max-w-lg space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input name="name" required defaultValue={convention?.name ?? ""} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea name="description" defaultValue={convention?.description ?? ""} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Location</span>
        <input name="location" defaultValue={convention?.location ?? ""} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      <div className="flex gap-4">
        <label className="block flex-1">
          <span className="text-sm font-medium">Start date</span>
          <input type="date" name="startDate" defaultValue={toDateInputValue(convention?.startDate)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium">End date</span>
          <input type="date" name="endDate" defaultValue={toDateInputValue(convention?.endDate)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
      </div>
      <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">{submitLabel}</button>
    </form>
  );
}
