import { notFound } from "next/navigation";
import PhotoGrid from "@/components/PhotoGrid";
import { getConventionBySlug } from "@/lib/conventions";

function formatRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export default async function ConventionGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const convention = await getConventionBySlug(slug);
  if (!convention) notFound();

  const range = formatRange(convention.startDate, convention.endDate);

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
      <PhotoGrid photos={[]} />
    </section>
  );
}
