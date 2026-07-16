"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { SHOW_NSFW_COOKIE } from "@/lib/nsfw";

export default function NsfwToggle({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.target.checked;
    setChecked(next);
    if (next) {
      document.cookie = `${SHOW_NSFW_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    } else {
      document.cookie = `${SHOW_NSFW_COOKIE}=; path=/; max-age=0`;
    }
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="h-4 w-4"
      />
      Show sensitive content by default
    </label>
  );
}
