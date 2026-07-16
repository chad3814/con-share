import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getConventionBySlug } from "@/lib/conventions";
import { getCurrentUser, isAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/s3";
import { SHOW_NSFW_COOKIE, showNsfwFromCookie } from "@/lib/nsfw";
import PhotoView from "./PhotoView";
import ReportForm from "./ReportForm";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ slug: string; photoId: string }>;
}) {
  const { slug, photoId } = await params;

  const convention = await getConventionBySlug(slug);
  if (!convention) notFound();

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: {
      tags: { include: { tag: true } },
      uploader: { select: { id: true, displayName: true } },
    },
  });
  if (!photo || photo.conventionId !== convention.id) notFound();

  if (photo.status === "TAKEN_DOWN") {
    return (
      <section className="space-y-2 py-12 text-center">
        <p className="text-gray-600">This photo has been removed.</p>
      </section>
    );
  }

  const isPubliclyVisible = photo.published && photo.status === "READY";
  if (!isPubliclyVisible) {
    const user = await getCurrentUser();
    const canView = photo.uploaderId === user?.id || isAdmin(user);
    if (!canView) notFound();
  }

  const cookieStore = await cookies();
  const showNsfw = showNsfwFromCookie(cookieStore.get(SHOW_NSFW_COOKIE)?.value);

  const credit = photo.photographerCredit ?? photo.uploader.displayName;

  return (
    <section className="mx-auto max-w-xl space-y-4">
      {photo.webKey ? (
        <PhotoView
          webUrl={publicUrl(photo.webKey)}
          alt={photo.description ?? ""}
          blurred={photo.nsfw && !showNsfw}
        />
      ) : null}

      {photo.description ? <p className="text-sm text-gray-800">{photo.description}</p> : null}

      {photo.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {photo.tags.map(({ tag }) => (
            <li
              key={tag.id}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
            >
              {tag.name}
            </li>
          ))}
        </ul>
      ) : null}

      {credit ? <p className="text-sm text-gray-500">Photo by {credit}</p> : null}

      <ReportForm photoId={photo.id} />
    </section>
  );
}
