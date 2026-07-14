import Link from "next/link";
import type { ConventionListItem } from "@/lib/conventions";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default function ConventionCard({ convention }: { convention: ConventionListItem }) {
  const range = formatRange(convention.startDate, convention.endDate);
  return (
    <Link
      href={`/c/${convention.slug}`}
      className="block overflow-hidden rounded-lg border border-gray-200 transition hover:border-gray-400"
    >
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-2xl font-bold text-gray-400">
        {convention.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="space-y-1 p-4">
        <h2 className="font-semibold">{convention.name}</h2>
        {range ? <p className="text-sm text-gray-600">{range}</p> : null}
        {convention.location ? (
          <p className="text-sm text-gray-500">{convention.location}</p>
        ) : null}
        <p className="text-xs text-gray-400">
          {convention.publishedPhotoCount} photo{convention.publishedPhotoCount === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
