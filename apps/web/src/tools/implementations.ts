import { extractPages } from "@/tools/client/extract-pages";
import { imageToPdf } from "@/tools/client/image-to-pdf";
import { mergePdf } from "@/tools/client/merge-pdf";
import { organizePdf } from "@/tools/client/organize-pdf";
import { pdfToImage } from "@/tools/client/pdf-to-image";
import { rotatePdf } from "@/tools/client/rotate-pdf";
import { splitPdf } from "@/tools/client/split-pdf";
import type { AnyToolImplementation } from "@/tools/types";

/** Implementations by tool slug. Tools without one show as "coming soon". */
export const IMPLEMENTATIONS: Readonly<Partial<Record<string, AnyToolImplementation>>> = {
  "merge-pdf": mergePdf,
  "split-pdf": splitPdf,
  "rotate-pdf": rotatePdf,
  "organize-pdf": organizePdf,
  "extract-pages": extractPages,
  "pdf-to-image": pdfToImage,
  "image-to-pdf": imageToPdf,
};
