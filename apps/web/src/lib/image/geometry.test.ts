import { describe, expect, it } from "vitest";
import { coverCrop, megapixels, targetSize } from "./geometry";
import { keptFormat, resolveFormat, usesQuality } from "./formats";

const photo = { width: 4000, height: 3000 };

describe("targetSize", () => {
  it("scales by a factor", () => {
    expect(targetSize(photo, { mode: "scale", factor: 0.25 })).toEqual({ width: 1000, height: 750 });
    expect(targetSize({ width: 3, height: 1 }, { mode: "scale", factor: 0.1 })).toEqual({ width: 1, height: 1 });
    expect(() => targetSize(photo, { mode: "scale", factor: 0 })).toThrow("above 0%");
  });

  it("follows the aspect ratio when one side is blank", () => {
    expect(targetSize(photo, { mode: "box", width: 800, height: null, fit: "inside" })).toEqual({ width: 800, height: 600 });
    expect(targetSize(photo, { mode: "box", width: null, height: 300, fit: "stretch" })).toEqual({ width: 400, height: 300 });
  });

  it("fits inside, crops to cover, or stretches to a box", () => {
    const box = { mode: "box", width: 1000, height: 1000 } as const;
    expect(targetSize(photo, { ...box, fit: "inside" })).toEqual({ width: 1000, height: 750 });
    expect(targetSize(photo, { ...box, fit: "cover" })).toEqual({ width: 1000, height: 1000 });
    expect(targetSize(photo, { ...box, fit: "stretch" })).toEqual({ width: 1000, height: 1000 });
  });

  it("rejects missing or fractional sizes", () => {
    expect(() => targetSize(photo, { mode: "box", width: null, height: null, fit: "inside" })).toThrow(
      "Enter a width, a height, or both.",
    );
    expect(() => targetSize(photo, { mode: "box", width: 10.5, height: null, fit: "inside" })).toThrow("whole numbers");
    expect(() => targetSize(photo, { mode: "box", width: -1, height: null, fit: "inside" })).toThrow("whole numbers");
  });
});

describe("coverCrop", () => {
  it("takes the centered region with the target's shape", () => {
    expect(coverCrop(photo, { width: 1080, height: 1080 })).toEqual({ x: 500, y: 0, width: 3000, height: 3000 });
    expect(coverCrop(photo, { width: 1600, height: 900 })).toEqual({ x: 0, y: 375, width: 4000, height: 2250 });
  });
});

describe("formats", () => {
  it("keeps web formats and turns the rest into JPEG or PNG", () => {
    expect(keptFormat("webp")).toBe("webp");
    expect(keptFormat("heic")).toBe("jpeg");
    expect(keptFormat("gif")).toBe("png");
    expect(resolveFormat("keep", "avif")).toBe("avif");
    expect(resolveFormat("png", "jpeg")).toBe("png");
    expect(usesQuality("png")).toBe(false);
    expect(usesQuality("webp")).toBe(true);
  });

  it("formats megapixels", () => {
    expect(megapixels(photo)).toBe("12 MP");
    expect(megapixels({ width: 1500, height: 1000 })).toBe("1.5 MP");
  });
});
