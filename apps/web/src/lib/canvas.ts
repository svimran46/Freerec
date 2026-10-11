/**
 * Canvas limits that hold in every major browser; iOS Safari caps a canvas at
 * 16,777,216 pixels.
 */
export const MAX_CANVAS_PIXELS = 16_777_216;
export const MAX_CANVAS_SIDE = 16_384;

/** The largest scale ≤ `scale` at which a `width` × `height` image fits on a canvas. */
export function fitCanvasScale(width: number, height: number, scale = 1): number {
  return Math.min(
    scale,
    MAX_CANVAS_SIDE / width,
    MAX_CANVAS_SIDE / height,
    Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
  );
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser couldn't encode the image."))),
      type,
      quality,
    ),
  );
}

/** Frees a canvas's pixel memory right away instead of waiting for garbage collection. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
