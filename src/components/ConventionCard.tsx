import Link from "next/link";
import type { ConventionListItem } from "@/lib/conventions";
import { formatDateRange } from "@/lib/date";
import { publicUrl } from "@/lib/s3";

export default function ConventionCard({ convention }: { convention: ConventionListItem }) {
  const range = formatDateRange(convention.startDate, convention.endDate);
  return (
    <div className="relative overflow-hidden rounded-lg border border-border transition hover:border-border">
      <Link href={`/c/${convention.slug}`} className="block">
        {convention.logoKey ? (
          <img
            src={publicUrl(convention.logoKey)}
            alt={`${convention.name} logo`}
            className="h-32 w-full bg-muted object-contain"
          />
        ) : (
          <div className="flex h-32 items-center justify-center bg-gradient-to-br from-muted to-border text-2xl font-bold text-muted-foreground">
            {convention.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="space-y-1 p-4">
          <h2 className="pr-6 font-semibold">{convention.name}</h2>
          {range ? <p className="text-sm text-muted-foreground">{range}</p> : null}
          {convention.location ? (
            <p className="text-sm text-muted-foreground">{convention.location}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {convention.publishedPhotoCount} photo{convention.publishedPhotoCount === 1 ? "" : "s"}
          </p>
        </div>
      </Link>
      {/* Rendered as a sibling of the card's Link (not nested inside it) to
          avoid an invalid <a> inside <a>; absolutely positioned so it still
          reads as sitting next to the convention name. */}
      {convention.url ? (
        <a
          href={convention.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${convention.name} website`}
          className="absolute right-4 top-36 leading-none"
        >
          🔗
        </a>
      ) : null}
    </div>
  );
}
