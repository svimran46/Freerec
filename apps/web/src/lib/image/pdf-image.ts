import { canvasToBlob, fitCanvasScale, releaseCanvas } from "@/lib/canvas";
import { jpegOrientation } from "@/lib/image/orientation";
import { PdfError, type PdfImage } from "@/lib/pdf/types";
import type { AcceptedFile } from "@/lib/validate-files";

/**
 * Gets an image ready to embed in a PDF. Upright JPEGs and PNGs go in as they
 * are, with no quality loss. Other formats, and photos stored sideways, are
 * redrawn upright by the browser: as JPEG for photos, PNG otherwise so
 * transparency survives.
 */
export async function toPdfImage({ file, kind }: AcceptedFile): Promise<PdfImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "png") return { name: file.name, type: "png", bytes };
  if (kind === "jpeg" && jpegOrientation(bytes) === 1) return { name: file.name, type: "jpeg", bytes };

  let bitmap: ImageBitmap;
  try {
    // Decoding applies the EXIF orientation, so the result is upright.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PdfError(`${file.name} couldn't be read. It may be damaged.`);
  }
  const scale = fitCanvasScale(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const type = kind === "jpeg" ? "jpeg" : "png";
  try {
    const blob = await canvasToBlob(canvas, `image/${type}`, 0.92);
    return { name: file.name, type, bytes: new Uint8Array(await blob.arrayBuffer()) };
  } finally {
    releaseCanvas(canvas);
  }
}
