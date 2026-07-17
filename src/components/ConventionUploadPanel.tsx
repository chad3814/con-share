"use client";

import { useState } from "react";
import Uploader from "@/app/upload/Uploader";

export default function ConventionUploadPanel({
  conventionId,
  conventionName,
}: {
  conventionId: string;
  conventionName?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        aria-expanded={open}
        aria-controls="convention-uploader"
      >
        {open ? "Hide uploader" : "Upload photos"}
      </button>
      {open ? (
        <div className="rounded-lg border border-border bg-card p-4" id="convention-uploader">
          {conventionName ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Uploading to {conventionName}
            </p>
          ) : null}
          <Uploader fixedConventionId={conventionId} />
        </div>
      ) : null}
    </div>
  );
}
