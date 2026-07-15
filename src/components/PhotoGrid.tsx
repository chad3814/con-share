export interface GalleryPhoto {
  id: string;
  thumbUrl: string;
  webUrl: string;
  nsfw: boolean;
  description: string | null;
}

export default function PhotoGrid({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) {
    return (
      <p className="py-12 text-center text-gray-500">
        No photos have been shared yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        // Phase 4: NSFW blur — gate rendering/blur on photo.nsfw here.
        <img
          key={photo.id}
          src={photo.thumbUrl}
          alt={photo.description ?? ""}
          loading="lazy"
          className="aspect-square w-full rounded object-cover"
        />
      ))}
    </div>
  );
}
