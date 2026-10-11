/**
 * Decoding, resizing, and encoding for the image worker. Codecs are WebAssembly
 * modules loaded on first use; this file runs only inside image.worker.ts.
 */
import type { FileKind } from "@/lib/file-kinds";
import type { OutputFormat } from "@/lib/image/formats";
import {
  coverCrop,
  MAX_INPUT_PIXELS,
  megapixels,
  targetSize,
  type ResizeSpec,
  type Size,
} from "@/lib/image/geometry";
import { encodeAvif, optimisePng } from "@/lib/image/single-thread";
import { ImageError } from "@/lib/image/types";

function checkPixels(name: string, size: Size): void {
  if (size.width * size.height > MAX_INPUT_PIXELS) {
    const limit = megapixels({ width: MAX_INPUT_PIXELS, height: 1 });
    throw new ImageError(`${name} is ${megapixels(size)}. The limit is ${limit}.`);
  }
}

async function decodeHeic(file: Blob, name: string): Promise<ImageData> {
  const { default: createLibheif } = await import("libheif-js/libheif-wasm/libheif-bundle.mjs");
  const libheif = await createLibheif();
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(await file.arrayBuffer()));
  // Other top-level images are alternates such as burst frames.
  const image = images.find((candidate) => candidate.is_primary()) ?? images[0];
  if (!image) throw new ImageError(`${name} has no image in it.`);
  try {
    const size = { width: image.get_width(), height: image.get_height() };
    checkPixels(name, size);
    const target = new ImageData(size.width, size.height);
    await new Promise<void>((resolve, reject) =>
      image.display(target, (result) => (result ? resolve() : reject(new Error("HEIF decode failed")))),
    );
    return target;
  } finally {
    for (const item of images) item.free();
  }
}

async function decodeTiff(file: Blob, name: string): Promise<ImageData> {
  // utif2 is CommonJS; bundlers expose module.exports as the default export.
  const UTIF = (await import("utif2")).default;
  const buffer = await file.arrayBuffer();
  const [page] = UTIF.decode(buffer);
  if (!page) throw new ImageError(`${name} has no image in it.`);
  // Check the size from the header before decompressing any pixels.
  const tag = (value: unknown) => Number(Array.isArray(value) ? value[0] : value);
  const size = { width: tag(page.t256), height: tag(page.t257) };
  if (!(size.width > 0 && size.height > 0)) throw new ImageError(`${name} couldn't be read. It may be damaged.`);
  checkPixels(name, size);
  UTIF.decodeImage(buffer, page);
  return new ImageData(new Uint8ClampedArray(UTIF.toRGBA8(page)), size.width, size.height);
}

/** Decoders for formats a browser may be unable to decode itself. */
async function decodeWithCodec(file: Blob, kind: FileKind): Promise<ImageData | null> {
  const buffer = await file.arrayBuffer();
  switch (kind) {
    case "avif":
      return (await import("@jsquash/avif/decode.js")).default(buffer);
    case "webp":
      return (await import("@jsquash/webp/decode.js")).default(buffer);
    case "jpeg":
      return (await import("@jsquash/jpeg/decode.js")).default(buffer);
    case "png":
      return (await import("@jsquash/png/decode.js")).default(buffer);
    default:
      return null;
  }
}

/** Decodes any supported image to upright RGBA pixels. */
export async function decode(file: Blob, name: string, kind: FileKind): Promise<ImageData> {
  if (kind === "heic") return decodeHeic(file, name);
  if (kind === "tiff") return decodeTiff(file, name);

  let bitmap: ImageBitmap | null = null;
  try {
    // Applies EXIF orientation; GIFs give their first frame.
    bitmap = await createImageBitmap(file);
  } catch {
    const fallback = await decodeWithCodec(file, kind).catch(() => null);
    if (fallback) {
      checkPixels(name, fallback);
      return fallback;
    }
    throw new ImageError(`${name} couldn't be read. It may be damaged.`);
  }
  try {
    checkPixels(name, bitmap);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function crop(image: ImageData, region: { x: number; y: number; width: number; height: number }): ImageData {
  const out = new ImageData(region.width, region.height);
  for (let row = 0; row < region.height; row++) {
    const start = ((region.y + row) * image.width + region.x) * 4;
    out.data.set(image.data.subarray(start, start + region.width * 4), row * region.width * 4);
  }
  return out;
}

export async function resize(image: ImageData, spec: ResizeSpec): Promise<ImageData> {
  const target = targetSize(image, spec);
  const cropping = spec.mode === "box" && spec.fit === "cover" && spec.width && spec.height;
  const source = cropping ? crop(image, coverCrop(image, target)) : image;
  if (source.width === target.width && source.height === target.height) return source;
  const { default: resizeImage } = await import("@jsquash/resize");
  return resizeImage(source, {
    width: target.width,
    height: target.height,
    method: "lanczos3",
    fitMethod: "stretch",
    premultiply: true,
    linearRGB: true,
  });
}

function hasTransparency(image: ImageData): boolean {
  for (let i = 3; i < image.data.length; i += 4) if (image.data[i] < 255) return true;
  return false;
}

/** Blends transparent pixels onto white, for formats without transparency. */
function flatten(image: ImageData): ImageData {
  if (!hasTransparency(image)) return image;
  const out = new ImageData(image.width, image.height);
  const src = image.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const alpha = src[i + 3] / 255;
    dst[i] = src[i] * alpha + 255 * (1 - alpha);
    dst[i + 1] = src[i + 1] * alpha + 255 * (1 - alpha);
    dst[i + 2] = src[i + 2] * alpha + 255 * (1 - alpha);
    dst[i + 3] = 255;
  }
  return out;
}

export async function encode(image: ImageData, format: OutputFormat, quality: number): Promise<ArrayBuffer> {
  switch (format) {
    case "jpeg": {
      const { default: encodeJpeg } = await import("@jsquash/jpeg/encode.js");
      return encodeJpeg(flatten(image), { quality, progressive: true, optimize_coding: true });
    }
    case "webp": {
      const { default: encodeWebp } = await import("@jsquash/webp/encode.js");
      return encodeWebp(image, { quality, method: 4 });
    }
    case "avif":
      // Speed 7 of 10 trades a little size for encodes that don't take minutes.
      return encodeAvif(image, { quality, speed: 7 });
    case "png":
      return optimisePng(image, 2);
  }
}
