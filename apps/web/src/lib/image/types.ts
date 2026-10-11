/**
 * Messages between the page and the image worker. This module must not import
 * the codecs, so pages can use it without loading them.
 */
import type { FileKind } from "@/lib/file-kinds";
import type { OutputFormat } from "@/lib/image/formats";
import type { ResizeSpec, Size } from "@/lib/image/geometry";

/** A failure whose message can be shown to the user as is. */
export class ImageError extends Error {
  override name = "ImageError";
}

export interface ImagePlan {
  resize?: ResizeSpec;
  format: OutputFormat;
  /** 1–100; ignored for PNG. */
  quality: number;
  /** Refuse outputs larger than this many pixels. */
  maxOutputPixels?: number;
}

export type ImageRequest =
  | { op: "process"; file: Blob; name: string; kind: FileKind; plan: ImagePlan }
  | { op: "probe"; file: Blob; name: string; kind: FileKind };

export interface ProcessResult {
  bytes: ArrayBuffer;
  size: Size;
  source: Size;
}

export type ImageResponse =
  | { ok: true; result: ProcessResult | Size }
  | { ok: false; name: string; message: string };
