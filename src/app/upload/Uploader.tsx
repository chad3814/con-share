"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { resolveContentType } from "@/lib/content-type";

type ConventionOption = { id: string; name: string };

type FileState = "pending" | "uploading" | "processing" | "ready" | "failed";

interface FileItem {
  name: string;
  size: number;
  contentType: string;
  state: FileState;
  webUrl?: string;
  error?: string;
}

interface FileEntry {
  file: File;
  contentType: string;
  photoId?: string;
  url?: string;
  uploaded: boolean;
  done: boolean;
}

interface PresignResponse {
  uploads: { photoId: string; key: string; url: string }[];
}

interface ProcessResponse {
  status: string;
  webUrl?: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const CONCURRENCY = 3;

async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const next = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
}

export default function Uploader({
  conventions = [],
  fixedConventionId,
}: {
  conventions?: ConventionOption[];
  fixedConventionId?: string;
}) {
  const [conventionId, setConventionId] = useState<string>(
    fixedConventionId ?? conventions[0]?.id ?? "",
  );
  const [items, setItems] = useState<FileItem[]>([]);
  const [batchInFlight, setBatchInFlight] = useState(false);
  const entriesRef = useRef<FileEntry[]>([]);

  function updateItem(index: number, patch: Partial<FileItem>): void {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>): void {
    const fileList = event.target.files;
    if (!fileList) return;
    const files = Array.from(fileList);
    entriesRef.current = files.map((file) => ({
      file,
      contentType: resolveContentType(file.type, file.name),
      uploaded: false,
      done: false,
    }));
    setItems(
      files.map((file) => ({
        name: file.name,
        size: file.size,
        contentType: resolveContentType(file.type, file.name),
        state: "pending",
      })),
    );
  }

  // Uploads (if not already uploaded) then processes a single file, updating
  // its row state as it progresses. Used both for the initial batch run and
  // for the per-file retry button.
  async function uploadOne(index: number): Promise<void> {
    const entry = entriesRef.current[index];
    if (!entry) return;

    if (!entry.photoId || !entry.url) {
      updateItem(index, { state: "failed", error: "Missing presigned upload target" });
      return;
    }

    try {
      if (!entry.uploaded) {
        updateItem(index, { state: "uploading", error: undefined });
        const putRes = await fetch(entry.url, {
          method: "PUT",
          headers: { "Content-Type": entry.contentType },
          body: entry.file,
        });
        if (!putRes.ok) {
          updateItem(index, { state: "failed", error: `Upload failed (${putRes.status})` });
          return;
        }
        entry.uploaded = true;
      }

      updateItem(index, { state: "processing" });
      const processRes = await fetch(`/api/uploads/${entry.photoId}/process`, { method: "POST" });
      if (!processRes.ok) {
        updateItem(index, { state: "failed", error: `Processing failed (${processRes.status})` });
        return;
      }
      const data = (await processRes.json()) as ProcessResponse;
      if (!data.webUrl) {
        updateItem(index, { state: "failed", error: "Processing succeeded but no image URL was returned" });
        return;
      }
      entry.done = true;
      updateItem(index, { state: "ready", webUrl: data.webUrl, error: undefined });
    } catch (error) {
      updateItem(index, {
        state: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async function handleUpload(): Promise<void> {
    const entries = entriesRef.current;
    if (batchInFlight || entries.length === 0 || !conventionId) return;

    const targets = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !entry.done);
    if (targets.length === 0) return;

    setBatchInFlight(true);
    try {
      const res = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conventionId,
          files: targets.map(({ entry }) => ({ contentType: entry.contentType, size: entry.file.size })),
        }),
      });

      if (!res.ok) {
        setItems((prev) => prev.map((item) => ({ ...item, state: "failed", error: `Presign failed (${res.status})` })));
        return;
      }

      const data = (await res.json()) as PresignResponse;
      data.uploads.forEach((upload, i) => {
        const target = targets[i];
        if (target) {
          target.entry.photoId = upload.photoId;
          target.entry.url = upload.url;
          target.entry.uploaded = false;
        }
      });

      await runPool(
        targets.map(({ index }) => index),
        CONCURRENCY,
        (index) => uploadOne(index),
      );
    } finally {
      setBatchInFlight(false);
    }
  }

  function handleRetry(index: number): void {
    void uploadOne(index);
  }

  const uploadDisabled = batchInFlight || items.length === 0 || !conventionId;

  return (
    <div className="space-y-4">
      {!fixedConventionId ? (
        <label className="block">
          <span className="text-sm font-medium">Convention</span>
          <select
            value={conventionId}
            onChange={(event) => setConventionId(event.target.value)}
            className="mt-1 w-full rounded border border-border px-3 py-2"
          >
            {conventions.map((convention) => (
              <option key={convention.id} value={convention.id}>
                {convention.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium">Photos</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFilesSelected}
          className="mt-1 block w-full text-sm"
        />
      </label>

      <button
        type="button"
        onClick={handleUpload}
        disabled={uploadDisabled}
        className="w-full rounded bg-primary py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground"
      >
        Upload
      </button>

      {items.length > 0 ? (
        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center gap-3 py-3">
              {item.state === "ready" && item.webUrl ? (
                <img src={item.webUrl} alt={item.name} className="h-24 w-24 rounded object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.state}</p>
                {item.error ? <p className="text-xs text-red-600">{item.error}</p> : null}
              </div>
              {item.state === "failed" ? (
                <button
                  type="button"
                  onClick={() => handleRetry(index)}
                  className="shrink-0 rounded border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted active:bg-border"
                >
                  Retry
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
