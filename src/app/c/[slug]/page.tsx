import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import NsfwToggle from "@/components/NsfwToggle";
import PhotoGrid from "@/components/PhotoGrid";
import { getConventionBySlug, getPublishedPhotos } from "@/lib/conventions";
import { formatDateRange } from "@/lib/date";
import { SHOW_NSFW_COOKIE, showNsfwFromCookie } from "@/lib/nsfw";
import { publicUrl } from "@/lib/s3";

export default async function ConventionGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const convention = await getConventionBySlug(slug);
  if (!convention) notFound();

  const range = formatDateRange(convention.startDate, convention.endDate);
  const cookieStore = await cookies();
  const showNsfw = showNsfwFromCookie(cookieStore.get(SHOW_NSFW_COOKIE)?.value);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          {convention.logoKey ? (
            <img
              src={publicUrl(convention.logoKey)}
              alt={`${convention.name} logo`}
              className="h-12 w-12 rounded bg-muted object-contain"
            />
          ) : null}
          <h1 className="text-2xl font-bold">{convention.name}</h1>
          {convention.url ? (
            <a
              href={convention.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${convention.name} website`}
            >
              🔗
            </a>
          ) : null}
        </div>
        {range ? <p className="text-muted-foreground">{range}</p> : null}
        {convention.location ? (
          <p className="text-muted-foreground">{convention.location}</p>
        ) : null}
        {convention.description ? (
          <p className="text-muted-foreground">{convention.description}</p>
        ) : null}
        <NsfwToggle initial={showNsfw} />
      </header>
      <PhotoGrid
        photos={await getPublishedPhotos(convention.id)}
        showNsfw={showNsfw}
      />
    </section>
  );
}
