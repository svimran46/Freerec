import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

/** Fails the test if a page sends anything to our API: these tools must stay on the device. */
export function forbidUploads(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) calls.push(request.url());
  });
  return () => expect(calls).toEqual([]);
}

export async function download(page: Page, name: string): Promise<Buffer> {
  const results = page.getByRole("region", { name: "Results" });
  const row = results.getByRole("listitem").filter({ hasText: name });
  const [file] = await Promise.all([page.waitForEvent("download"), row.getByRole("button").click()]);
  expect(file.suggestedFilename()).toBe(name);
  return readFile((await file.path())!);
}

export interface ImageInfo {
  type: "jpeg" | "png" | "webp" | "avif";
  width: number;
  height: number;
  /** PNG only: whether it keeps transparency, as an alpha channel or a palette tRNS chunk. */
  alpha?: boolean;
}

/** Reads an image's format and size from its header, without decoding it. */
export function imageInfo(bytes: Buffer): ImageInfo {
  if (bytes.subarray(1, 4).toString() === "PNG") {
    const alpha = bytes[25] >= 4 || bytes.includes("tRNS");
    return { type: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), alpha };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset < bytes.length; ) {
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      // Start-of-frame markers carry the size; C4, C8 and CC are other tables.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "jpeg", height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (bytes.subarray(8, 12).toString() === "WEBP") {
    const chunk = bytes.subarray(12, 16).toString();
    if (chunk === "VP8X") {
      return { type: "webp", width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    }
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { type: "webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    return { type: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  const ispe = bytes.indexOf("ispe");
  if (bytes.subarray(4, 8).toString() === "ftyp" && ispe > 0) {
    return { type: "avif", width: bytes.readUInt32BE(ispe + 8), height: bytes.readUInt32BE(ispe + 12) };
  }
  throw new Error("Unknown image format");
}
