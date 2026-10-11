import { compressImage } from "@/tools/client/compress-image";
import { convertImage } from "@/tools/client/convert-image";
import { extractPages } from "@/tools/client/extract-pages";
import { imageToPdf } from "@/tools/client/image-to-pdf";
import { mergePdf } from "@/tools/client/merge-pdf";
import { organizePdf } from "@/tools/client/organize-pdf";
import { pdfToImage } from "@/tools/client/pdf-to-image";
import { resizeImage } from "@/tools/client/resize-image";
import { rotatePdf } from "@/tools/client/rotate-pdf";
import { splitPdf } from "@/tools/client/split-pdf";
import { upscaleImage } from "@/tools/client/upscale-image";
import {
  compressPdf,
  ebookConverter,
  htmlToPdf,
  officeToPdf,
  pdfToExcel,
  pdfToPowerpoint,
  pdfToWord,
} from "@/tools/server/tools";
import type { AnyToolImplementation } from "@/tools/types";

/**
 * Server tools need the processing backend. Builds turn them on with
 * NEXT_PUBLIC_SERVER_TOOLS=true once BACKEND_URL points at a running one.
 */
export const SERVER_TOOLS_ENABLED = process.env.NEXT_PUBLIC_SERVER_TOOLS === "true";

const SERVER_TOOLS: Record<string, AnyToolImplementation> = {
  "compress-pdf": compressPdf,
  "office-to-pdf": officeToPdf,
  "pdf-to-word": pdfToWord,
  "pdf-to-excel": pdfToExcel,
  "pdf-to-powerpoint": pdfToPowerpoint,
  "html-to-pdf": htmlToPdf,
  "ebook-converter": ebookConverter,
};

/** Implementations by tool slug. Tools without one show as "coming soon". */
export const IMPLEMENTATIONS: Readonly<Partial<Record<string, AnyToolImplementation>>> = {
  "merge-pdf": mergePdf,
  "split-pdf": splitPdf,
  "rotate-pdf": rotatePdf,
  "organize-pdf": organizePdf,
  "extract-pages": extractPages,
  "pdf-to-image": pdfToImage,
  "image-to-pdf": imageToPdf,
  "compress-image": compressImage,
  "resize-image": resizeImage,
  "convert-image": convertImage,
  "upscale-image": upscaleImage,
  ...(SERVER_TOOLS_ENABLED ? SERVER_TOOLS : {}),
};

/** Every implementation, whether or not this build enables it; for tests. */
export const ALL_IMPLEMENTATIONS: Readonly<Partial<Record<string, AnyToolImplementation>>> = {
  ...IMPLEMENTATIONS,
  ...SERVER_TOOLS,
};
