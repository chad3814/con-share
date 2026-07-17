import { notFound } from "next/navigation";
import ConventionForm from "../../ConventionForm";
import { updateConventionAction } from "../../actions";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/s3";

export default async function EditConventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const convention = await prisma.convention.findUnique({ where: { id } });
  if (!convention) notFound();

  const action = updateConventionAction.bind(null, id);
  const logoUrl = convention.logoKey ? publicUrl(convention.logoKey) : null;
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Edit convention</h1>
      <ConventionForm action={action} convention={convention} submitLabel="Save" logoUrl={logoUrl} />
    </section>
  );
}
