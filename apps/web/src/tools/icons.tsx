import {
  ArrowClockwise,
  ArrowsInSimple,
  ArrowsLeftRight,
  ArrowsOutSimple,
  BookOpenText,
  Cards,
  FileDoc,
  FileHtml,
  FileImage,
  FilePdf,
  FilePpt,
  Files,
  FileText,
  FileXls,
  FileZip,
  Gauge,
  ImageSquare,
  MagnifyingGlassPlus,
  Scissors,
  SquaresFour,
  Stack,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps } from "@phosphor-icons/react";
import { createElement } from "react";
import type { ToolCategory } from "@/tools/registry";

/** One glyph per tool, drawn from Phosphor so every surface uses the same family. */
export const TOOL_ICONS: Record<string, Icon> = {
  "merge-pdf": Stack,
  "split-pdf": Scissors,
  "rotate-pdf": ArrowClockwise,
  "organize-pdf": SquaresFour,
  "extract-pages": Cards,
  "pdf-to-image": FileImage,
  "image-to-pdf": FilePdf,
  "compress-image": ArrowsInSimple,
  "resize-image": ArrowsOutSimple,
  "convert-image": ArrowsLeftRight,
  "upscale-image": MagnifyingGlassPlus,
  "compress-pdf": FileZip,
  "office-to-pdf": FileText,
  "pdf-to-word": FileDoc,
  "pdf-to-excel": FileXls,
  "pdf-to-powerpoint": FilePpt,
  "html-to-pdf": FileHtml,
  "ebook-converter": BookOpenText,
};

export const CATEGORY_ICONS: Record<ToolCategory, Icon> = {
  organize: Files,
  image: ImageSquare,
  convert: ArrowsLeftRight,
  optimize: Gauge,
};

/** A tool's glyph, rendered as a stable component. */
export function ToolIcon({ slug, ...props }: { slug: string } & IconProps) {
  return createElement(TOOL_ICONS[slug] ?? FileText, props);
}
