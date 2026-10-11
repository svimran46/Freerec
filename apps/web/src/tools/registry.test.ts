import { describe, expect, it } from "vitest";
import { FILE_KINDS } from "@/lib/file-kinds";
import { LIMITS } from "@/lib/limits";
import { ALL_IMPLEMENTATIONS, IMPLEMENTATIONS } from "./implementations";
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

  it("implements every tool, and only registered tools", () => {
    for (const tool of TOOLS) expect(ALL_IMPLEMENTATIONS[tool.slug], tool.slug).toBeDefined();
    for (const slug of Object.keys(ALL_IMPLEMENTATIONS)) expect(getTool(slug), slug).toBeDefined();
  });

  it("leaves server tools off unless the build enables them", () => {
    for (const tool of TOOLS) {
      expect(IMPLEMENTATIONS[tool.slug] !== undefined, tool.slug).toBe(tool.runtime !== "server");
    }
  });
});
