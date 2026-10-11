"use client";

import { ChoiceGroup, Field, inputClass } from "@/components/form";
import { PdfStatus } from "@/components/pdf/PageGrid";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { canvasToBlob, releaseCanvas } from "@/lib/canvas";
import type { OutputFile } from "@/lib/download";
import { stemOf } from "@/lib/file-kinds";
import { parseRanges, rangeIndices } from "@/lib/pdf/ranges";
import { closePdf, openPdf, renderPage, renderScale } from "@/lib/pdf/render";
import { defineTool, type OptionsProps } from "@/tools/types";

interface ToImageOptions {
  pageCount: number | null;
  format: "jpeg" | "png";
  /** JPEG quality, 1–100. */
  quality: number;
  dpi: "72" | "150" | "300";
  /** Page ranges to convert; blank converts every page. */
  pages: string;
}

/** The page indices to convert, or why the selection isn't usable. */
function pageList({ pageCount, pages }: ToImageOptions): number[] | string {
  if (pageCount === null) return "Reading the PDF…";
  if (pages.trim() === "") return Array.from({ length: pageCount }, (_, i) => i);
  try {
    return [...new Set(rangeIndices(parseRanges(pages, pageCount)))];
  } catch (error) {
    return (error as Error).message;
  }
}

function ToImageOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<ToImageOptions>) {
  const { error } = usePdfDocument(files[0].file, (pageCount) =>
    setOptions((o) => ({ ...o, pageCount })),
  );
  if (error || options.pageCount === null) return <PdfStatus error={error} />;

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        legend="Format"
        name="image-format"
        value={options.format}
        disabled={disabled}
        choices={[
          { value: "jpeg", label: "JPG (smaller)" },
          { value: "png", label: "PNG (sharper)" },
        ]}
        onChange={(format) => setOptions((o) => ({ ...o, format }))}
      />
      {options.format === "jpeg" && (
        <Field label={`Quality: ${options.quality}`} hint="Lower quality makes smaller files.">
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={options.quality}
            disabled={disabled}
            onChange={(event) => setOptions((o) => ({ ...o, quality: event.target.valueAsNumber }))}
            className="max-w-sm accent-accent"
          />
        </Field>
      )}
      <ChoiceGroup
        legend="Resolution"
        name="image-dpi"
        value={options.dpi}
        disabled={disabled}
        choices={[
          { value: "72", label: "Screen · 72 DPI" },
          { value: "150", label: "Standard · 150 DPI" },
          { value: "300", label: "Print · 300 DPI" },
        ]}
        onChange={(dpi) => setOptions((o) => ({ ...o, dpi }))}
      />
      <Field
        label="Pages"
        hint={`Leave blank for all ${options.pageCount} pages, or type ranges like 1-3, 8.`}
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder="All pages"
          value={options.pages}
          disabled={disabled}
          onChange={(event) => setOptions((o) => ({ ...o, pages: event.target.value }))}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

export const pdfToImage = defineTool<ToImageOptions>({
  initialOptions: () => ({ pageCount: null, format: "jpeg", quality: 85, dpi: "150", pages: "" }),
  Options: ToImageOptionsPanel,
  blocker: (_files, options) => {
    const pages = pageList(options);
    return typeof pages === "string" ? pages : null;
  },
  async process(files, options, { signal, onProgress }) {
    const pages = pageList(options);
    if (typeof pages === "string") throw new Error(pages);
    const { file } = files[0];
    const stem = stemOf(file.name);
    const extension = options.format === "jpeg" ? "jpg" : "png";
    const digits = String(options.pageCount).length;
    const doc = await openPdf(file);
    const outputs: OutputFile[] = [];
    try {
      for (const [done, index] of pages.entries()) {
        signal.throwIfAborted();
        onProgress({ done, total: pages.length, unit: "pages" });
        const page = await doc.getPage(index + 1);
        const { width, height } = page.getViewport({ scale: 1 });
        const canvas = await renderPage(page, {
          scale: renderScale(width, height, Number(options.dpi)),
          signal,
        });
        try {
          const data = await canvasToBlob(canvas, `image/${options.format}`, options.quality / 100);
          const number = String(index + 1).padStart(digits, "0");
          outputs.push({ name: `${stem}-page-${number}.${extension}`, data });
        } finally {
          releaseCanvas(canvas);
          page.cleanup();
        }
      }
    } finally {
      await closePdf(doc);
    }
    return outputs;
  },
});
