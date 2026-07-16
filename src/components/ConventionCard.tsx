import Link from "next/link";
import type { ConventionListItem } from "@/lib/conventions";
import { formatDateRange } from "@/lib/date";

export default function ConventionCard({ convention }: { convention: ConventionListItem }) {
  const range = formatDateRange(convention.startDate, convention.endDate);
  return (
    <Link
      href={`/c/${convention.slug}`}
      className="block overflow-hidden rounded-lg border border-border transition hover:border-border"
    >
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-muted to-border text-2xl font-bold text-muted-foreground">
        {convention.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="space-y-1 p-4">
        <h2 className="font-semibold">{convention.name}</h2>
        {range ? <p className="text-sm text-muted-foreground">{range}</p> : null}
        {convention.location ? (
          <p className="text-sm text-muted-foreground">{convention.location}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {convention.publishedPhotoCount} photo{convention.publishedPhotoCount === 1 ? "" : "s"}
        </p>
      </div>
    </Link>
  );
}
