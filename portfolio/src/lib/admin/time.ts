/** "3 minutes ago" style relative time for a row's updatedAt, already present on every admin row. */
export function formatRelativeTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 30) return "just now";

  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = seconds;
  for (const [size, label] of units) {
    if (value < size) {
      const n = Math.floor(value);
      return `${n} ${label}${n === 1 ? "" : "s"} ago`;
    }
    value /= size;
  }
  return null;
}
