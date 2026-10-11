import { PDFDocument } from "pdf-lib";

/**
 * Makes a PDF whose page widths encode their original page numbers:
 * page n is 100 + n points wide, so tests can read back the page order.
 */
export async function numberedPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let n = 1; n <= pageCount; n++) doc.addPage([100 + n, 200]);
  return doc.save();
}

export async function pageNumbers(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getWidth() - 100);
}

export async function pageRotations(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getRotation().angle);
}

export function pdfFile(bytes: Uint8Array, name = "doc.pdf"): File {
  return new File([bytes as Uint8Array<ArrayBuffer>], name, { type: "application/pdf" });
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** A 4×2 red PNG. */
export const PNG_4X2 = fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEklEQVR4nGM8ISfHAANMDEgAABlYAQijcLdOAAAAAElFTkSuQmCC",
);

/** A 4×2 red JPEG with no EXIF data. */
export const JPEG_4X2 = fromBase64(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkKKKK8U/TD//Z",
);

/**
 * Splices an EXIF APP1 segment with the given orientation tag into a JPEG,
 * right after its start-of-image marker.
 */
export function withExifOrientation(jpeg: Uint8Array, orientation: number, littleEndian = false): Uint8Array {
  const tiff = new Uint8Array(26);
  const view = new DataView(tiff.buffer);
  view.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, 8, littleEndian); // IFD0 follows the header
  view.setUint16(8, 1, littleEndian); // one entry
  view.setUint16(10, 0x0112, littleEndian); // Orientation
  view.setUint16(12, 3, littleEndian); // SHORT
  view.setUint32(14, 1, littleEndian); // count
  view.setUint16(18, orientation, littleEndian);
  const exif = new Uint8Array([...new TextEncoder().encode("Exif\0\0"), ...tiff]);
  const segment = new Uint8Array(4 + exif.length);
  segment.set([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]);
  segment.set(exif, 4);
  return new Uint8Array([...jpeg.subarray(0, 2), ...segment, ...jpeg.subarray(2)]);
}
