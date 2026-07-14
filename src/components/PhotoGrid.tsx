export interface GalleryPhoto {
  id: string;
  webKey: string | null;
  thumbKey: string | null;
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
        <div key={photo.id} className="aspect-square rounded bg-gray-100" />
      ))}
    </div>
  );
}
