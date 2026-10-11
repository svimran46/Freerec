import { describe, expect, it } from "vitest";
import { chunkPages, formatIndices, parseRanges, rangeIndices, rangeLabel } from "./ranges";

describe("parseRanges", () => {
  it("reads single pages, closed ranges, and open ends", () => {
    expect(parseRanges("1-3, 5, 8-", 10)).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 4 },
      { start: 7, end: 9 },
    ]);
    expect(parseRanges(" -2 ;4 – 4", 5)).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 3 },
    ]);
  });

  it("explains what is wrong", () => {
    expect(() => parseRanges("", 3)).toThrow("Enter at least one page");
    expect(() => parseRanges("1-4", 3)).toThrow("Page 4 doesn't exist. This PDF has 3 pages.");
    expect(() => parseRanges("0", 1)).toThrow("This PDF has 1 page.");
    expect(() => parseRanges("5-2", 9)).toThrow("Write “5-2” low to high, like 2-5.");
    expect(() => parseRanges("1-2-3", 9)).toThrow("“1-2-3” isn't a page or a range.");
    expect(() => parseRanges("-", 9)).toThrow("isn't a page or a range");
  });
});

describe("range helpers", () => {
  it("expands ranges in order", () => {
    expect(rangeIndices([{ start: 2, end: 3 }, { start: 0, end: 0 }])).toEqual([2, 3, 0]);
  });

  it("formats indices as compact 1-based ranges", () => {
    expect(formatIndices([4, 0, 1, 2, 2, 7])).toBe("1-3, 5, 8");
    expect(formatIndices([])).toBe("");
  });

  it("chunks pages into equal parts with a shorter tail", () => {
    expect(chunkPages(5, 2)).toEqual([
      { start: 0, end: 1 },
      { start: 2, end: 3 },
      { start: 4, end: 4 },
    ]);
    expect(() => chunkPages(5, 0)).toThrow(RangeError);
    expect(() => chunkPages(5, Number.NaN)).toThrow(RangeError);
  });

  it("labels ranges for file names", () => {
    expect(rangeLabel({ start: 0, end: 2 })).toBe("pages-1-3");
    expect(rangeLabel({ start: 4, end: 4 })).toBe("page-5");
  });
});
