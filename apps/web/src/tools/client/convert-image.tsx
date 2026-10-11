"use client";

import { stemOf } from "@/lib/file-kinds";
import { processImages } from "@/lib/image/client";
import { OUTPUT_FORMATS, usesQuality, type OutputFormat } from "@/lib/image/formats";
import { defineTool, type OptionsProps } from "@/tools/types";
import { FormatPicker, imageOutput, QualitySlider } from "@/tools/client/image-shared";

interface ConvertOptions {
  format: OutputFormat;
  quality: number;
}

function ConvertOptionsPanel({ options, setOptions, disabled }: OptionsProps<ConvertOptions>) {
  return (
    <div className="flex flex-col gap-5">
      <FormatPicker
        value={options.format}
        allowKeep={false}
        disabled={disabled}
        onChange={(format) => setOptions((o) => ({ ...o, format }))}
      />
      {usesQuality(options.format) ? (
        <QualitySlider
          value={options.quality}
          disabled={disabled}
          onChange={(quality) => setOptions((o) => ({ ...o, quality }))}
        />
      ) : (
        <p className="text-sm text-text-muted">PNG is lossless and keeps transparency.</p>
      )}
      {options.format === "jpeg" && (
        <p className="text-sm text-text-muted">JPG has no transparency; transparent areas become white.</p>
      )}
      {options.format === "avif" && (
        <p className="text-sm text-text-muted">AVIF makes the smallest files but takes longest to create.</p>
      )}
    </div>
  );
}

export const convertImage = defineTool<ConvertOptions>({
  initialOptions: () => ({ format: "jpeg", quality: 90 }),
  Options: ConvertOptionsPanel,
  async process(files, { format, quality }, { signal, onProgress }) {
    const results = await processImages(
      files.map((item) => ({ item, plan: { format, quality } })),
      { signal, onDone: (done) => onProgress({ done, total: files.length, unit: "images" }) },
    );
    return files.map(({ file }, i) =>
      imageOutput(`${stemOf(file.name)}.${OUTPUT_FORMATS[format].extension}`, format, results[i], file),
    );
  },
});
