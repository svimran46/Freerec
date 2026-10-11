"use client";

import { ChoiceGroup } from "@/components/form";
import { stemOf } from "@/lib/file-kinds";
import { toPdfImages } from "@/lib/image/pdf-image";
import { runPdfOp } from "@/lib/pdf/client";
import type { Orientation, PageSize } from "@/lib/pdf/types";
import { defineTool, type OptionsProps } from "@/tools/types";
import { pdfOutput } from "@/tools/client/shared";

type Margin = "none" | "small" | "large";

interface ImagesOptions {
  pageSize: PageSize;
  orientation: Orientation;
  margin: Margin;
}

/** Margins in points: none, a quarter inch, half an inch. */
const MARGINS: Record<Margin, number> = { none: 0, small: 18, large: 36 };

function ImagesOptionsPanel({ options, setOptions, disabled }: OptionsProps<ImagesOptions>) {
  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        legend="Page size"
        name="page-size"
        value={options.pageSize}
        disabled={disabled}
        choices={[
          { value: "fit", label: "Same as image" },
          { value: "a4", label: "A4" },
          { value: "letter", label: "US Letter" },
        ]}
        onChange={(pageSize) => setOptions((o) => ({ ...o, pageSize }))}
      />
      {options.pageSize !== "fit" && (
        <ChoiceGroup
          legend="Orientation"
          name="orientation"
          value={options.orientation}
          disabled={disabled}
          choices={[
            { value: "auto", label: "Match each image" },
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
          ]}
          onChange={(orientation) => setOptions((o) => ({ ...o, orientation }))}
        />
      )}
      <ChoiceGroup
        legend="Margin"
        name="margin"
        value={options.margin}
        disabled={disabled}
        choices={[
          { value: "none", label: "None" },
          { value: "small", label: "Small" },
          { value: "large", label: "Large" },
        ]}
        onChange={(margin) => setOptions((o) => ({ ...o, margin }))}
      />
    </div>
  );
}

export const imageToPdf = defineTool<ImagesOptions>({
  initialOptions: () => ({ pageSize: "a4", orientation: "auto", margin: "small" }),
  Options: ImagesOptionsPanel,
  async process(files, options, { signal, onProgress }) {
    const images = await toPdfImages(files, {
      signal,
      onDone: (done) => onProgress({ done, total: files.length, unit: "images" }),
    });
    const layout = { pageSize: options.pageSize, orientation: options.orientation, margin: MARGINS[options.margin] };
    const bytes = await runPdfOp("imagesToPdf", [images, layout], signal);
    const name = files.length === 1 ? `${stemOf(files[0].file.name)}.pdf` : "images.pdf";
    return [pdfOutput(name, bytes)];
  },
});
