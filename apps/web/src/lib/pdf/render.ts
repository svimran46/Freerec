import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { fitCanvasScale, releaseCanvas } from "@/lib/canvas";
import { LIMITS } from "@/lib/limits";
import { PdfError } from "@/lib/pdf/types";

/** Where scripts/copy-pdfjs-assets.mjs puts the fonts, CMaps, and decoders pdf.js loads on demand. */
const ASSETS = "/pdfjs";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/**
 * Loads pdf.js on first use, with its parser in a module worker. The legacy
 * build is used because the modern one relies on JavaScript features that
 * shipped only in 2026 browsers, such as Map.prototype.getOrInsertComputed.
 */
function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
    }
    return pdfjs;
  });
  return pdfjsPromise;
}

/** Opens a PDF for rendering. The caller must {@link closePdf} it when done. */
export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${ASSETS}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}/standard_fonts/`,
    wasmUrl: `${ASSETS}/wasm/`,
    iccUrl: `${ASSETS}/iccs/`,
  });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (error) {
    await task.destroy();
    if (error instanceof Error && error.name === "PasswordException") {
      throw new PdfError(`${file.name} is password-protected. Remove the password, then try again.`);
    }
    throw new PdfError(`${file.name} couldn't be read. It may be damaged or not really a PDF.`);
  }
  if (doc.numPages > LIMITS.maxPdfPages) {
    const count = doc.numPages;
    await closePdf(doc);
    throw new PdfError(`${file.name} has ${count} pages. The limit is ${LIMITS.maxPdfPages}.`);
  }
  return doc;
}

/** Closes a document opened with {@link openPdf} and frees its worker-side memory. */
export function closePdf(doc: PDFDocumentProxy): Promise<void> {
  return doc.loadingTask.destroy();
}

/**
 * The render scale for a page of `width` × `height` points at `dpi`, reduced
 * when needed to stay within the canvas limits.
 */
export function renderScale(width: number, height: number, dpi: number): number {
  return fitCanvasScale(width, height, dpi / 72);
}

/** Renders a page onto a new canvas. `rotate` adds a clockwise turn in degrees. */
export async function renderPage(
  page: PDFPageProxy,
  { scale, rotate = 0, signal }: { scale: number; rotate?: number; signal?: AbortSignal },
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale, rotation: page.rotate + rotate });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const task = page.render({ canvas, viewport });
  const cancel = () => task.cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await task.promise;
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
  return canvas;
}
