export function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

export function toDateInputValue(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
