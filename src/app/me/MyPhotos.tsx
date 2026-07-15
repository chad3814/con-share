"use client";

import type { MouseEvent } from "react";
import TagInput from "@/components/TagInput";
import { deletePhotoAction, setPublishedAction, updatePhotoAction } from "./actions";

export interface MyPhoto {
  id: string;
  status: string;
  published: boolean;
  nsfw: boolean;
  description: string | null;
  photographerCredit: string | null;
  conventionName: string;
  thumbUrl: string | null;
  tags: string[];
}

function confirmDelete(event: MouseEvent<HTMLButtonElement>): void {
  if (!confirm("Delete this photo permanently?")) {
    event.preventDefault();
  }
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {status}
    </span>
  );
}

function PhotoRow({ photo }: { photo: MyPhoto }) {
  const canPublish = photo.status === "READY";

  return (
    <li className="space-y-3 rounded border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        {photo.thumbUrl ? (
          <img
            src={photo.thumbUrl}
            alt={photo.description ?? ""}
            className="h-20 w-20 rounded object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded bg-gray-50">
            <StatusChip status={photo.status} />
          </div>
        )}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">{photo.conventionName}</p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span>{photo.published ? "Published" : "Unpublished"}</span>
            {photo.nsfw ? <span>NSFW</span> : null}
            {photo.status !== "READY" ? <StatusChip status={photo.status} /> : null}
          </div>
        </div>
      </div>

      <form action={setPublishedAction.bind(null, photo.id, !photo.published)}>
        <button
          type="submit"
          disabled={!canPublish}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {photo.published ? "Unpublish" : "Publish"}
        </button>
      </form>

      <form action={updatePhotoAction.bind(null, photo.id)} className="space-y-2">
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            name="description"
            defaultValue={photo.description ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Photographer credit</span>
          <input
            name="photographerCredit"
            defaultValue={photo.photographerCredit ?? ""}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="nsfw" defaultChecked={photo.nsfw} />
          <span className="text-sm font-medium">NSFW</span>
        </label>
        <TagInput name="tags" defaultValue={photo.tags} />
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Save
        </button>
      </form>

      <form action={deletePhotoAction.bind(null, photo.id)}>
        <button
          type="submit"
          onClick={confirmDelete}
          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
        >
          Delete
        </button>
      </form>
    </li>
  );
}

export default function MyPhotos({ photos }: { photos: MyPhoto[] }) {
  return (
    <ul className="space-y-4">
      {photos.map((photo) => (
        <PhotoRow key={photo.id} photo={photo} />
      ))}
    </ul>
  );
}
