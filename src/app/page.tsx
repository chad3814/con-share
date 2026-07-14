import ConventionCard from "@/components/ConventionCard";
import { listPublicConventions } from "@/lib/conventions";

export default async function HomePage() {
  const conventions = await listPublicConventions();
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Con-Share</h1>
        <p className="text-gray-600">Browse photos shared from conventions.</p>
      </div>
      {conventions.length === 0 ? (
        <p className="text-gray-500">No conventions yet. Check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conventions.map((c) => (
            <ConventionCard key={c.id} convention={c} />
          ))}
        </div>
      )}
    </section>
  );
}
