import { describe, expect, it } from "vitest";
import { JPEG_4X2, withExifOrientation } from "@/test/fixtures";
import { jpegOrientation } from "./orientation";

describe("jpegOrientation", () => {
  it("reads the EXIF orientation in either byte order", () => {
    expect(jpegOrientation(withExifOrientation(JPEG_4X2, 6))).toBe(6);
    expect(jpegOrientation(withExifOrientation(JPEG_4X2, 3, true))).toBe(3);
  });

  it("treats missing, invalid, or truncated data as upright", () => {
    expect(jpegOrientation(JPEG_4X2)).toBe(1);
    expect(jpegOrientation(withExifOrientation(JPEG_4X2, 42))).toBe(1);
    expect(jpegOrientation(withExifOrientation(JPEG_4X2, 6).subarray(0, 20))).toBe(1);
    expect(jpegOrientation(new Uint8Array([0x89, 0x50]))).toBe(1);
  });
});
