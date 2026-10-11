import { describe, expect, it } from "vitest";
import { FILE_KINDS } from "@/lib/file-kinds";
import { LIMITS } from "@/lib/limits";
import { CATEGORIES, getTool, TOOLS, toolsByCategory } from "./registry";

describe("tool registry", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("only references known file kinds and stays within global limits", () => {
    for (const tool of TOOLS) {
      expect(tool.accepts.length).toBeGreaterThan(0);
      for (const kind of tool.accepts) expect(FILE_KINDS).toHaveProperty(kind);
      expect(tool.maxFileBytes).toBeLessThanOrEqual(LIMITS.maxFileBytes);
      expect(tool.maxFiles).toBeLessThanOrEqual(LIMITS.maxFiles);
      expect(tool.multiple || tool.maxFiles === 1).toBe(true);
    }
  });

  it("includes every MVP image tool from the plan", () => {
    for (const slug of ["compress-image", "resize-image", "convert-image", "upscale-image"]) {
      expect(getTool(slug)?.category).toBe("image");
    }
  });

  it("groups every tool under a known category", () => {
    const grouped = toolsByCategory();
    expect(grouped.map((g) => g.category)).toEqual(Object.keys(CATEGORIES));
    expect(grouped.flatMap((g) => g.tools)).toHaveLength(TOOLS.length);
  });
});
