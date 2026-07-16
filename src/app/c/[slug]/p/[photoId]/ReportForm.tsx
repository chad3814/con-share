"use client";

import { useState } from "react";
import { createReportAction } from "@/app/report/actions";

export default function ReportForm({ photoId }: { photoId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const boundAction = createReportAction.bind(null, photoId);

  async function handle(formData: FormData): Promise<void> {
    await boundAction(formData);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        Thanks — this photo has been reported.
      </p>
    );
  }

  return (
    <form action={handle} className="space-y-3 rounded border border-gray-200 p-4">
      <h2 className="text-sm font-semibold">Report this photo</h2>
      <div className="space-y-1">
        <label htmlFor="category" className="block text-sm font-medium">
          Reason
        </label>
        <select
          id="category"
          name="category"
          defaultValue="ABUSE"
          className="w-full rounded border border-gray-300 p-2 text-sm"
        >
          <option value="ABUSE">Abuse</option>
          <option value="COPYRIGHT">Copyright</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="message" className="block text-sm font-medium">
          Details (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="w-full rounded border border-gray-300 p-2 text-sm"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded bg-red-600 px-4 py-2 text-sm font-medium text-white"
      >
        Submit report
      </button>
      <p className="text-xs text-gray-500">
        Copyright claim? Use the <a href="/dmca" className="underline">DMCA form</a>.
      </p>
    </form>
  );
}
