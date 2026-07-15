import { notFound } from "next/navigation";
import PhotoGrid from "@/components/PhotoGrid";
import { getConventionBySlug, getPublishedPhotos } from "@/lib/conventions";
import { formatDateRange } from "@/lib/date";

export default async function ConventionGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const convention = await getConventionBySlug(slug);
  if (!convention) notFound();

  const range = formatDateRange(convention.startDate, convention.endDate);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{convention.name}</h1>
        {range ? <p className="text-gray-600">{range}</p> : null}
        {convention.location ? (
          <p className="text-gray-600">{convention.location}</p>
        ) : null}
        {convention.description ? (
          <p className="text-gray-600">{convention.description}</p>
        ) : null}
      </header>
      <PhotoGrid photos={await getPublishedPhotos(convention.id)} />
    </section>
  );
}
