import type { FileKind } from "@/lib/file-kinds";
import { processImages } from "@/lib/image/client";
import { jpegOrientation } from "@/lib/image/orientation";
import type { PdfImage } from "@/lib/pdf/types";
import type { AcceptedFile } from "@/lib/validate-files";

/** Photos are redrawn as high-quality JPEG; everything else as PNG, so transparency and sharp edges survive. */
const PHOTO_KINDS: readonly FileKind[] = ["jpeg", "heic"];

/**
 * Gets images ready to embed in a PDF. Upright JPEGs and PNGs go in as they
 * are, with no quality loss. Other formats, and photos stored sideways, are
 * decoded upright in a worker and re-encoded.
 */
export async function toPdfImages(
  items: readonly AcceptedFile[],
  { signal, onDone }: { signal: AbortSignal; onDone?: (done: number) => void },
): Promise<PdfImage[]> {
  const images: (PdfImage | undefined)[] = await Promise.all(
    items.map(async ({ file, kind }) => {
      if (kind !== "png" && kind !== "jpeg") return undefined;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (kind === "jpeg" && jpegOrientation(bytes) !== 1) return undefined;
      return { name: file.name, type: kind, bytes };
    }),
  );
  const pending = items.flatMap((_, i) => (images[i] ? [] : [i]));
  const ready = items.length - pending.length;
  onDone?.(ready);
  const redrawn = await processImages(
    pending.map((i) => ({
      item: items[i],
      plan: { format: PHOTO_KINDS.includes(items[i].kind) ? ("jpeg" as const) : ("png" as const), quality: 92 },
    })),
    { signal, onDone: (done) => onDone?.(ready + done) },
  );
  pending.forEach((index, i) => {
    const type = PHOTO_KINDS.includes(items[index].kind) ? "jpeg" : "png";
    images[index] = { name: items[index].file.name, type, bytes: new Uint8Array(redrawn[i].bytes) };
  });
  return images as PdfImage[];
}
