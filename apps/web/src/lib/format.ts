const UNITS = ["B", "KB", "MB", "GB"];

/** Human-readable byte size using 1024-based units, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

/** "120 KB, 64% smaller" or "1.2 MB, 30% larger". */
export function sizeChange(before: number, after: number): string {
  const change = Math.round((1 - after / before) * 100);
  if (change === 0) return `${formatBytes(after)}, about the same size`;
  return `${formatBytes(after)}, ${Math.abs(change)}% ${change > 0 ? "smaller" : "larger"}`;
}
