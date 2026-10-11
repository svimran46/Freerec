/** An inclusive range of 0-based page indices. */
export interface PageRange {
  start: number;
  end: number;
}

/**
 * Parses page ranges as people type them: 1-based, comma separated, with open
 * ends allowed ("1-3, 5, 8-" or "-4"). Throws a RangeError with a message fit to
 * show the user.
 */
export function parseRanges(input: string, pageCount: number): PageRange[] {
  const parts = input
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new RangeError("Enter at least one page or range, like 1-3, 5.");

  return parts.map((part) => {
    const match = /^(\d*)\s*[-–]\s*(\d*)$/.exec(part) ?? /^(\d+)$/.exec(part);
    if (!match || (match[1] === "" && match[2] === "")) {
      throw new RangeError(`“${part}” isn't a page or a range.`);
    }
    const single = match.length === 2;
    const first = match[1] === "" ? 1 : Number(match[1]);
    const last = single ? first : match[2] === "" ? pageCount : Number(match[2]);
    for (const page of [first, last]) {
      if (page < 1 || page > pageCount) {
        throw new RangeError(
          `Page ${page} doesn't exist. This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
        );
      }
    }
    if (first > last) throw new RangeError(`Write “${part}” low to high, like ${last}-${first}.`);
    return { start: first - 1, end: last - 1 };
  });
}

/** Expands ranges to page indices, keeping their order and repeats. */
export function rangeIndices(ranges: readonly PageRange[]): number[] {
  return ranges.flatMap(({ start, end }) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i),
  );
}

/** Formats sorted, unique 0-based indices as 1-based ranges: [0,1,2,4] → "1-3, 5". */
export function formatIndices(indices: readonly number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(start === sorted[i] ? `${start + 1}` : `${start + 1}-${sorted[i] + 1}`);
  }
  return parts.join(", ");
}

/** Splits pages into consecutive chunks of `size` pages; the last chunk may be shorter. */
export function chunkPages(pageCount: number, size: number): PageRange[] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Enter a whole number of pages.");
  const ranges: PageRange[] = [];
  for (let start = 0; start < pageCount; start += size) {
    ranges.push({ start, end: Math.min(start + size, pageCount) - 1 });
  }
  return ranges;
}

/** Label for a range in output file names: "pages-1-3" or "page-5". */
export function rangeLabel({ start, end }: PageRange): string {
  return start === end ? `page-${start + 1}` : `pages-${start + 1}-${end + 1}`;
}
