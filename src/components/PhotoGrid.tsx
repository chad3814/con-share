import PhotoThumb from "@/components/PhotoThumb";

export interface GalleryPhoto {
  id: string;
  thumbUrl: string;
  webUrl: string;
  nsfw: boolean;
  description: string | null;
}

export default function PhotoGrid({
  photos,
  showNsfw,
}: {
  photos: GalleryPhoto[];
  showNsfw: boolean;
}) {
  if (photos.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        No photos have been shared yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <PhotoThumb
          key={photo.id}
          thumbUrl={photo.thumbUrl}
          alt={photo.description ?? ""}
          blurred={photo.nsfw && !showNsfw}
        />
      ))}
    </div>
  );
}
