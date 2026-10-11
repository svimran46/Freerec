/**
 * Types shared by the PDF code. This module must not import pdf-lib or pdf.js,
 * so pages can use it without pulling those libraries into their bundles.
 */

/** A failure whose message can be shown to the user as is. */
export class PdfError extends Error {
  override name = "PdfError";
}

export interface NamedBytes {
  name: string;
  bytes: Uint8Array;
}

/** One page of an output document: a source page index plus a clockwise turn. */
export interface PageSpec {
  index: number;
  /** Degrees to add to the page's current rotation; a multiple of 90. */
  rotate?: number;
}

export type PageSize = "fit" | "a4" | "letter";
export type Orientation = "auto" | "portrait" | "landscape";

export interface ImageLayout {
  pageSize: PageSize;
  orientation: Orientation;
  /** Space around each image, in points. */
  margin: number;
}

/** An image already in a format PDFs embed directly. */
export interface PdfImage {
  name: string;
  type: "jpeg" | "png";
  bytes: Uint8Array;
}

/** Adds a turn to a rotation, normalized to 0, 90, 180, or 270. */
export function addTurn(current: number, delta: number): number {
  return (((current + delta) % 360) + 360) % 360;
}
