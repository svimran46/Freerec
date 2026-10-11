import { degrees, PDFDocument } from "pdf-lib";
import { LIMITS } from "@/lib/limits";
import type { PageRange } from "@/lib/pdf/ranges";
import {
  addTurn,
  PdfError,
  type ImageLayout,
  type NamedBytes,
  type PageSize,
  type PageSpec,
  type PdfImage,
} from "@/lib/pdf/types";

const PRODUCER = "Freerec";

/** Loads a PDF, turning library errors into messages fit for the user. */
export async function loadPdf({ name, bytes }: NamedBytes): Promise<PDFDocument> {
  let doc: PDFDocument;
  let count: number;
  try {
    // Load encrypted files too, so they can be told apart from damaged ones below.
    doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    if (doc.isEncrypted) {
      throw new PdfError(`${name} is password-protected. Remove the password, then try again.`);
    }
    // Broken files can load and then fail on first access to the page tree.
    count = doc.getPageCount();
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError(`${name} couldn't be read. It may be damaged or not really a PDF.`);
  }
  if (count === 0) throw new PdfError(`${name} has no pages.`);
  if (count > LIMITS.maxPdfPages) {
    throw new PdfError(`${name} has ${count} pages. The limit is ${LIMITS.maxPdfPages}.`);
  }
  return doc;
}

async function createOutput(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setProducer(PRODUCER);
  doc.setCreator(PRODUCER);
  return doc;
}

/** Copies pages from `source` into `target` in order, applying each page's turn. */
async function appendPages(target: PDFDocument, source: PDFDocument, pages: readonly PageSpec[]) {
  const copied = await target.copyPages(
    source,
    pages.map((page) => page.index),
  );
  copied.forEach((page, i) => {
    const delta = pages[i].rotate ?? 0;
    if (delta % 360 !== 0) page.setRotation(degrees(addTurn(page.getRotation().angle, delta)));
    target.addPage(page);
  });
}

/** Joins whole documents in the order given. */
export async function mergePdfs(inputs: readonly NamedBytes[]): Promise<Uint8Array> {
  const output = await createOutput();
  for (const input of inputs) {
    const source = await loadPdf(input);
    await appendPages(
      output,
      source,
      source.getPageIndices().map((index) => ({ index })),
    );
  }
  return output.save();
}

/**
 * Builds a new document from selected pages of one source. This covers reordering,
 * deleting, extracting, and rotating pages.
 */
export async function rebuildPdf(input: NamedBytes, pages: readonly PageSpec[]): Promise<Uint8Array> {
  if (pages.length === 0) throw new PdfError("Keep at least one page.");
  const source = await loadPdf(input);
  const count = source.getPageCount();
  for (const { index } of pages) {
    if (!Number.isInteger(index) || index < 0 || index >= count) {
      throw new PdfError(`Page ${index + 1} doesn't exist in ${input.name}.`);
    }
  }
  const output = await createOutput();
  await appendPages(output, source, pages);
  return output.save();
}

/** Writes one document per range. */
export async function splitPdf(input: NamedBytes, ranges: readonly PageRange[]): Promise<Uint8Array[]> {
  const source = await loadPdf(input);
  const count = source.getPageCount();
  const outputs: Uint8Array[] = [];
  for (const { start, end } of ranges) {
    if (start < 0 || end >= count || start > end) {
      throw new PdfError(`Pages ${start + 1}-${end + 1} don't exist in ${input.name}.`);
    }
    const output = await createOutput();
    await appendPages(
      output,
      source,
      Array.from({ length: end - start + 1 }, (_, i) => ({ index: start + i })),
    );
    outputs.push(await output.save());
  }
  return outputs;
}

/** Page sizes in points (1/72 inch), portrait. */
const PAGE_SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Images placed on "fit" pages keep their size at 96 pixels per inch. */
const POINTS_PER_PIXEL = 72 / 96;

/** Works out the page size and the image's box on it. Exported for tests. */
export function placeImage(
  width: number,
  height: number,
  { pageSize, orientation, margin }: ImageLayout,
): { page: [number, number]; box: { x: number; y: number; width: number; height: number } } {
  if (pageSize === "fit") {
    const w = width * POINTS_PER_PIXEL;
    const h = height * POINTS_PER_PIXEL;
    return {
      page: [w + 2 * margin, h + 2 * margin],
      box: { x: margin, y: margin, width: w, height: h },
    };
  }
  const [short, long] = PAGE_SIZES[pageSize];
  const landscape = orientation === "landscape" || (orientation === "auto" && width > height);
  const [pageW, pageH] = landscape ? [long, short] : [short, long];
  const scale = Math.min((pageW - 2 * margin) / width, (pageH - 2 * margin) / height);
  const w = width * scale;
  const h = height * scale;
  return {
    page: [pageW, pageH],
    box: { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h },
  };
}

/** Puts each image on its own page. */
export async function imagesToPdf(images: readonly PdfImage[], layout: ImageLayout): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfError("Add at least one image.");
  const output = await createOutput();
  for (const image of images) {
    let embedded;
    try {
      embedded = image.type === "jpeg" ? await output.embedJpg(image.bytes) : await output.embedPng(image.bytes);
    } catch {
      throw new PdfError(`${image.name} couldn't be read. It may be damaged.`);
    }
    const { page, box } = placeImage(embedded.width, embedded.height, layout);
    output.addPage(page).drawImage(embedded, box);
  }
  return output.save();
}
