import { imagesToPdf, mergePdfs, rebuildPdf, splitPdf } from "@/lib/pdf/edit";

/** The PDF edits that run in a worker. Each takes and returns plain, transferable data. */
export const PDF_OPS = { mergePdfs, rebuildPdf, splitPdf, imagesToPdf };

export type PdfOps = typeof PDF_OPS;
export type PdfOpName = keyof PdfOps;

export interface PdfOpRequest {
  op: PdfOpName;
  args: unknown[];
}

export type PdfOpResponse =
  | { ok: true; result: unknown }
  | { ok: false; name: string; message: string };
