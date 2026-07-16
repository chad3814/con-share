import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Uploader from "./Uploader";

export default async function UploadPage() {
  await requireUser();

  const conventions = await prisma.convention.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Upload photos</h1>
      {conventions.length === 0 ? (
        <p className="text-muted-foreground">No conventions yet — an admin needs to create one.</p>
      ) : (
        <Uploader conventions={conventions} />
      )}
    </section>
  );
}
