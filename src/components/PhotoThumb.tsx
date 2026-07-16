"use client";

import { useState } from "react";

export default function PhotoThumb({
  thumbUrl,
  alt,
  blurred,
}: {
  thumbUrl: string;
  alt: string;
  blurred: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  if (blurred && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="relative block aspect-square w-full overflow-hidden rounded"
      >
        <img
          src={thumbUrl}
          alt={alt}
          loading="lazy"
          className="aspect-square w-full rounded object-cover blur-lg"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-background/70 p-2 text-center text-sm font-medium text-foreground">
          Sensitive content — tap to reveal
        </span>
      </button>
    );
  }

  return (
    <img
      src={thumbUrl}
      alt={alt}
      loading="lazy"
      className="aspect-square w-full rounded object-cover"
    />
  );
}
