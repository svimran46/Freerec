import type { FileKind } from "@/lib/file-kinds";

/** Formats the image tools can write. */
export type OutputFormat = "jpeg" | "png" | "webp" | "avif";

export const OUTPUT_FORMATS: Record<OutputFormat, { label: string; mime: string; extension: string }> = {
  jpeg: { label: "JPG", mime: "image/jpeg", extension: "jpg" },
  png: { label: "PNG", mime: "image/png", extension: "png" },
  webp: { label: "WebP", mime: "image/webp", extension: "webp" },
  avif: { label: "AVIF", mime: "image/avif", extension: "avif" },
};

/** A choice of output format, where "keep" writes the input's own format when possible. */
export type FormatChoice = OutputFormat | "keep";

/**
 * The format to write when the user keeps the input's format. Inputs browsers
 * can't display everywhere become JPEG (photos) or PNG (graphics).
 */
export function keptFormat(kind: FileKind): OutputFormat {
  switch (kind) {
    case "jpeg":
    case "png":
    case "webp":
    case "avif":
      return kind;
    case "heic":
    case "tiff":
      return "jpeg";
    default:
      return "png";
  }
}

export function resolveFormat(choice: FormatChoice, kind: FileKind): OutputFormat {
  return choice === "keep" ? keptFormat(kind) : choice;
}

/** PNG is lossless, so the quality setting doesn't apply to it. */
export function usesQuality(format: OutputFormat): boolean {
  return format !== "png";
}
