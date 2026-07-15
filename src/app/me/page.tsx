import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/s3";
import { updateDisplayNameAction } from "./actions";
import MyPhotos, { type MyPhoto } from "./MyPhotos";

export default async function MePage() {
  const user = await requireUser();

  const [photos, currentUser] = await Promise.all([
    prisma.photo.findMany({
      where: { uploaderId: user.id },
      include: {
        convention: { select: { name: true, slug: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true } }),
  ]);

  const mapped: MyPhoto[] = photos.map((photo) => ({
    id: photo.id,
    status: photo.status,
    published: photo.published,
    nsfw: photo.nsfw,
    description: photo.description,
    photographerCredit: photo.photographerCredit,
    conventionName: photo.convention.name,
    thumbUrl: photo.status === "READY" && photo.thumbKey ? publicUrl(photo.thumbKey) : null,
    tags: photo.tags.map((t) => t.tag.name),
  }));

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">My photos</h1>

      <form action={updateDisplayNameAction} className="max-w-sm space-y-2">
        <label className="block">
          <span className="text-sm font-medium">Display name</span>
          <input
            name="displayName"
            defaultValue={currentUser?.displayName ?? ""}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Save name
        </button>
      </form>

      {mapped.length === 0 ? (
        <p className="text-gray-500">
          You haven&apos;t uploaded any photos yet.{" "}
          <Link href="/upload" className="text-blue-600 underline">
            Upload some
          </Link>
          .
        </p>
      ) : (
        <MyPhotos photos={mapped} />
      )}
    </section>
  );
}
