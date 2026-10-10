import type { FileKind } from "@/lib/file-kinds";
import { LIMITS } from "@/lib/limits";

export type ToolCategory = "organize" | "image" | "convert" | "optimize";

/**
 * Where a tool's processing happens:
 * - client: in the browser; files never leave the device
 * - server: on our workers; files are deleted after {@link LIMITS.retentionMinutes}
 * - hybrid: a fast mode runs in the browser and an advanced mode on the server
 */
export type ToolRuntime = "client" | "server" | "hybrid";

export interface ToolDefinition {
  slug: string;
  title: string;
  /** One-line description shown on cards and as the page meta description. */
  summary: string;
  category: ToolCategory;
  runtime: ToolRuntime;
  accepts: readonly FileKind[];
  multiple: boolean;
  maxFiles: number;
  maxFileBytes: number;
  /** Delivery phase from docs/PLAN.md; a tool is usable once its processor ships. */
  phase: 1 | 2 | 3;
}

export const CATEGORIES: Record<ToolCategory, { title: string; blurb: string }> = {
  organize: { title: "Organize PDF", blurb: "Merge, split, and rearrange pages." },
  image: { title: "Image tools", blurb: "Compress, resize, convert, and upscale images." },
  convert: { title: "Convert", blurb: "Move between PDF, Office, images, web pages, and ebooks." },
  optimize: { title: "Optimize", blurb: "Make PDFs smaller and faster to share." },
};

const IMAGE_KINDS = ["jpeg", "png", "webp", "gif", "avif", "heic", "bmp", "tiff"] as const;
const OFFICE_KINDS = [
  "docx", "xlsx", "pptx", "doc", "xls", "ppt", "odt", "ods", "odp", "rtf", "txt",
] as const;
const EBOOK_KINDS = ["epub", "mobi", "azw3", "pdf"] as const;

const single = { multiple: false, maxFiles: 1, maxFileBytes: LIMITS.maxFileBytes } as const;
const batch = { multiple: true, maxFiles: LIMITS.maxFiles, maxFileBytes: LIMITS.maxFileBytes } as const;

export const TOOLS: readonly ToolDefinition[] = [
  // Phase 1 — client-side PDF organize
  {
    slug: "merge-pdf", title: "Merge PDF", category: "organize", runtime: "client", phase: 1,
    summary: "Combine several PDFs into one, in the order you choose.",
    accepts: ["pdf"], ...batch,
  },
  {
    slug: "split-pdf", title: "Split PDF", category: "organize", runtime: "client", phase: 1,
    summary: "Split a PDF by page ranges or into equal parts.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "rotate-pdf", title: "Rotate PDF", category: "organize", runtime: "client", phase: 1,
    summary: "Rotate all pages or just the ones you pick.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "organize-pdf", title: "Reorder & delete pages", category: "organize", runtime: "client",
    phase: 1, summary: "Drag pages into a new order and remove the ones you don't need.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "extract-pages", title: "Extract pages", category: "organize", runtime: "client",
    phase: 1, summary: "Pull selected pages out into a new PDF.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "pdf-to-image", title: "PDF to image", category: "convert", runtime: "client", phase: 1,
    summary: "Turn each PDF page into a JPG or PNG.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "image-to-pdf", title: "Images to PDF", category: "convert", runtime: "client", phase: 1,
    summary: "Put JPG, PNG, and other images into a single PDF.",
    accepts: ["jpeg", "png", "webp", "gif", "bmp"], ...batch,
  },

  // Phase 2 — image suite
  {
    slug: "compress-image", title: "Compress image", category: "image", runtime: "client",
    phase: 2, summary: "Shrink images with a quality slider and a live before/after preview.",
    accepts: IMAGE_KINDS, ...batch,
  },
  {
    slug: "resize-image", title: "Resize image", category: "image", runtime: "client", phase: 2,
    summary: "Resize by pixels, percentage, or preset, with aspect ratio locked or free.",
    accepts: IMAGE_KINDS, ...batch,
  },
  {
    slug: "convert-image", title: "Convert image", category: "image", runtime: "client", phase: 2,
    summary: "Convert between JPG, PNG, WebP, AVIF, and more. HEIC photos are supported.",
    accepts: IMAGE_KINDS, ...batch,
  },
  {
    slug: "upscale-image", title: "Upscale image", category: "image", runtime: "hybrid", phase: 2,
    summary: "Enlarge images 2× or 4× with classic resampling or AI detail recovery.",
    accepts: ["jpeg", "png", "webp"], ...single,
  },

  // Phase 3 — server conversions
  {
    slug: "compress-pdf", title: "Compress PDF", category: "optimize", runtime: "server", phase: 3,
    summary: "Reduce PDF file size with a choice of quality presets.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "office-to-pdf", title: "Office to PDF", category: "convert", runtime: "server",
    phase: 3, summary: "Convert Word, Excel, PowerPoint, and OpenDocument files to PDF.",
    accepts: OFFICE_KINDS, ...single,
  },
  {
    slug: "pdf-to-word", title: "PDF to Word", category: "convert", runtime: "server", phase: 3,
    summary: "Turn a PDF into an editable DOCX document.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "pdf-to-excel", title: "PDF to Excel", category: "convert", runtime: "server", phase: 3,
    summary: "Extract tables from a PDF into an XLSX spreadsheet.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "pdf-to-powerpoint", title: "PDF to PowerPoint", category: "convert", runtime: "server",
    phase: 3, summary: "Turn each PDF page into a PPTX slide.",
    accepts: ["pdf"], ...single,
  },
  {
    slug: "html-to-pdf", title: "HTML to PDF", category: "convert", runtime: "server", phase: 3,
    summary: "Render an HTML file as a print-ready PDF.",
    accepts: ["html"], ...single,
  },
  {
    slug: "ebook-converter", title: "Ebook converter", category: "convert", runtime: "server",
    phase: 3, summary: "Convert between EPUB, MOBI, AZW3, and PDF.",
    accepts: EBOOK_KINDS, ...single,
  },
];

export function getTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function toolsByCategory(): { category: ToolCategory; tools: ToolDefinition[] }[] {
  return (Object.keys(CATEGORIES) as ToolCategory[]).map((category) => ({
    category,
    tools: TOOLS.filter((tool) => tool.category === category),
  }));
}
