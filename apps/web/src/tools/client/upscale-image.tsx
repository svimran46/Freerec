"use client";

import { LoadStatus } from "@/components/LoadStatus";
import { ChoiceGroup } from "@/components/form";
import { useImageSize } from "@/components/useImageSize";
import { stemOf } from "@/lib/file-kinds";
import { processImages } from "@/lib/image/client";
import { OUTPUT_FORMATS, resolveFormat, type FormatChoice } from "@/lib/image/formats";
import { megapixels, UPSCALE_LIMITS, type Size } from "@/lib/image/geometry";
import { defineTool, type OptionsProps } from "@/tools/types";
import { FormatPicker, imageOutput } from "@/tools/client/image-shared";

interface UpscaleOptions {
  factor: 2 | 4;
  format: FormatChoice;
  source: Size | null;
}

/** Why the image can't be enlarged this much, or null when it can. */
function tooLarge({ factor, source }: UpscaleOptions): string | null {
  if (!source) return null;
  const limit = UPSCALE_LIMITS[factor];
  if (source.width * source.height <= limit) return null;
  const smaller = factor === 4 && source.width * source.height <= UPSCALE_LIMITS[2] ? " Try 2×, or" : "";
  return `${factor}× works on images up to ${megapixels({ width: limit, height: 1 })}; this one is ${megapixels(source)}.${smaller || " Try"} resizing it first.`;
}

function UpscaleOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<UpscaleOptions>) {
  const { error } = useImageSize(files[0], (source) => setOptions((o) => ({ ...o, source })));
  if (error || !options.source) return <LoadStatus error={error} loading="Reading the image…" />;
  const { width, height } = options.source;

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        legend="Enlarge"
        name="upscale-factor"
        value={String(options.factor) as "2" | "4"}
        disabled={disabled}
        choices={[
          { value: "2", label: "2×" },
          { value: "4", label: "4×" },
        ]}
        onChange={(value) => setOptions((o) => ({ ...o, factor: Number(value) as 2 | 4 }))}
      />
      <FormatPicker
        value={options.format}
        allowKeep
        disabled={disabled}
        onChange={(format) => setOptions((o) => ({ ...o, format }))}
      />
      <p className="text-sm text-text-muted" aria-live="polite">
        {width} × {height} → {width * options.factor} × {height * options.factor}. Uses Lanczos resampling, which
        keeps edges crisp but can&apos;t invent detail that isn&apos;t there.
      </p>
    </div>
  );
}

export const upscaleImage = defineTool<UpscaleOptions>({
  initialOptions: () => ({ factor: 2, format: "keep", source: null }),
  Options: UpscaleOptionsPanel,
  blocker: (_files, options) => (options.source ? tooLarge(options) : "Reading the image…"),
  async process(files, options, { signal }) {
    const [item] = files;
    const format = resolveFormat(options.format, item.kind);
    const [result] = await processImages(
      [
        {
          item,
          plan: {
            resize: { mode: "scale", factor: options.factor },
            format,
            quality: 92,
            maxOutputPixels: UPSCALE_LIMITS[2] * 4,
          },
        },
      ],
      { signal },
    );
    const name = `${stemOf(item.file.name)}-${options.factor}x.${OUTPUT_FORMATS[format].extension}`;
    return [imageOutput(name, format, result, item.file)];
  },
});
