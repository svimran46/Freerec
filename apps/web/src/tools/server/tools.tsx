"use client";

import { ChoiceGroup } from "@/components/form";
import { FILE_KINDS } from "@/lib/file-kinds";
import { sizeChange } from "@/lib/format";
import { Note, serverTool } from "@/tools/server/server-tool";
import type { OptionsProps } from "@/tools/types";

type Level = "high" | "balanced" | "small";

function CompressOptions({ options, setOptions, disabled }: OptionsProps<{ level: Level }>) {
  return (
    <ChoiceGroup
      legend="Compression"
      name="compress-level"
      value={options.level}
      disabled={disabled}
      choices={[
        { value: "high", label: "Light · best quality" },
        { value: "balanced", label: "Balanced" },
        { value: "small", label: "Strong · smallest file" },
      ]}
      onChange={(level) => setOptions(() => ({ level }))}
    />
  );
}

export const compressPdf = serverTool<{ level: Level }>({
  slug: "compress-pdf",
  initialOptions: () => ({ level: "balanced" }),
  Options: CompressOptions,
  apiOptions: (options) => options,
  describe: (output, [input]) =>
    output.data.size >= input.file.size
      ? "Already compact, so the original is kept"
      : sizeChange(input.file.size, output.data.size),
});

export const officeToPdf = serverTool<null>({
  slug: "office-to-pdf",
  initialOptions: () => null,
});

export const pdfToWord = serverTool<null>({
  slug: "pdf-to-word",
  initialOptions: () => null,
  Options: Note({
    children:
      "Works best on text documents. Columns, tables, and positioned images may shift, and scanned pages come out as images.",
  }),
});

export const pdfToExcel = serverTool<null>({
  slug: "pdf-to-excel",
  initialOptions: () => null,
  Options: Note({
    children:
      "Each page with tables becomes a sheet, with numbers kept as numbers. Without tables, you get the text one line per row.",
  }),
});

export const pdfToPowerpoint = serverTool<null>({
  slug: "pdf-to-powerpoint",
  initialOptions: () => null,
  Options: Note({ children: "Each page becomes a slide showing a picture of the page. The text isn't editable." }),
});

interface HtmlOptions {
  pageSize: "a4" | "letter";
  landscape: boolean;
  margin: "none" | "small" | "normal";
}

function HtmlOptionsPanel({ options, setOptions, disabled }: OptionsProps<HtmlOptions>) {
  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        legend="Page size"
        name="html-page-size"
        value={options.pageSize}
        disabled={disabled}
        choices={[
          { value: "a4", label: "A4" },
          { value: "letter", label: "US Letter" },
        ]}
        onChange={(pageSize) => setOptions((o) => ({ ...o, pageSize }))}
      />
      <ChoiceGroup
        legend="Orientation"
        name="html-orientation"
        value={options.landscape ? "landscape" : "portrait"}
        disabled={disabled}
        choices={[
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" },
        ]}
        onChange={(value) => setOptions((o) => ({ ...o, landscape: value === "landscape" }))}
      />
      <ChoiceGroup
        legend="Margins"
        name="html-margin"
        value={options.margin}
        disabled={disabled}
        choices={[
          { value: "none", label: "None" },
          { value: "small", label: "Small" },
          { value: "normal", label: "Normal" },
        ]}
        onChange={(margin) => setOptions((o) => ({ ...o, margin }))}
      />
      <p className="text-sm text-text-muted">
        For your safety, scripts don&apos;t run and nothing is loaded from the internet. Images show only if
        they&apos;re embedded in the file.
      </p>
    </div>
  );
}

export const htmlToPdf = serverTool<HtmlOptions>({
  slug: "html-to-pdf",
  initialOptions: () => ({ pageSize: "a4", landscape: false, margin: "normal" }),
  Options: HtmlOptionsPanel,
  apiOptions: ({ pageSize, landscape, margin }) => ({ page_size: pageSize, landscape, margin }),
});

type EbookFormat = "epub" | "mobi" | "azw3" | "pdf";

function EbookOptions({ options, setOptions, disabled }: OptionsProps<{ output: EbookFormat }>) {
  return (
    <ChoiceGroup
      legend="Convert to"
      name="ebook-output"
      value={options.output}
      disabled={disabled}
      choices={(["epub", "mobi", "azw3", "pdf"] as const).map((value) => ({
        value,
        label: FILE_KINDS[value].label,
      }))}
      onChange={(output) => setOptions(() => ({ output }))}
    />
  );
}

export const ebookConverter = serverTool<{ output: EbookFormat }>({
  slug: "ebook-converter",
  initialOptions: (files) => ({ output: files[0]?.kind === "epub" ? "pdf" : "epub" }),
  Options: EbookOptions,
  blocker: ([input], { output }) =>
    input && input.kind === output ? `It's already ${FILE_KINDS[output].label}. Choose another format.` : null,
  apiOptions: (options) => options,
});
