"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "indigo", label: "Indigo" },
  { value: "teal", label: "Teal" },
  { value: "amber", label: "Amber" },
] as const;

const SELECT_CLASS =
  "rounded border border-border bg-card px-2 py-1 text-sm text-foreground";

export default function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <select aria-label="Theme" disabled className={SELECT_CLASS}>
        <option>System</option>
      </select>
    );
  }

  return (
    <select
      aria-label="Theme"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      className={SELECT_CLASS}
    >
      {THEME_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
