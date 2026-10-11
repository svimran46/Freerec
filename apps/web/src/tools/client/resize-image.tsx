"use client";

import { ChoiceGroup, Field, inputClass } from "@/components/form";
import { useImageSize } from "@/components/useImageSize";
import { stemOf } from "@/lib/file-kinds";
import { processImages } from "@/lib/image/client";
import { OUTPUT_FORMATS, resolveFormat, usesQuality, type FormatChoice } from "@/lib/image/formats";
import { MAX_INPUT_PIXELS, targetSize, type ResizeSpec, type Size } from "@/lib/image/geometry";
import { defineTool, type OptionsProps } from "@/tools/types";
import { FormatPicker, imageOutput, QualitySlider } from "@/tools/client/image-shared";

export const PRESETS = {
  "instagram-square": { label: "Instagram post, square", width: 1080, height: 1080 },
  "instagram-portrait": { label: "Instagram post, portrait", width: 1080, height: 1350 },
  story: { label: "Instagram or TikTok story", width: 1080, height: 1920 },
  "facebook-post": { label: "Facebook or LinkedIn link image", width: 1200, height: 630 },
  "x-post": { label: "X post", width: 1600, height: 900 },
  "youtube-thumbnail": { label: "YouTube thumbnail", width: 1280, height: 720 },
  "linkedin-banner": { label: "LinkedIn banner", width: 1584, height: 396 },
  "full-hd": { label: "Full HD", width: 1920, height: 1080 },
} as const;

type PresetKey = keyof typeof PRESETS;

interface ResizeOptions {
  mode: "size" | "percent" | "preset";
  /** Pixel fields as typed; blank means "follow the aspect ratio". */
  width: string;
  height: string;
  fit: "inside" | "cover" | "stretch";
  percent: number;
  preset: PresetKey;
  format: FormatChoice;
  quality: number;
  /** Size of the first image, once read, for the preview line. */
  source: Size | null;
}

function pixels(text: string): number | null {
  return text.trim() === "" ? null : Number(text);
}

/** The resize to apply, or why the settings aren't usable. */
function resizeSpec(options: ResizeOptions): ResizeSpec | string {
  let spec: ResizeSpec;
  switch (options.mode) {
    case "percent":
      spec = { mode: "scale", factor: options.percent / 100 };
      break;
    case "preset": {
      const { width, height } = PRESETS[options.preset];
      spec = { mode: "box", width, height, fit: "cover" };
      break;
    }
    default:
      spec = { mode: "box", width: pixels(options.width), height: pixels(options.height), fit: options.fit };
  }
  try {
    targetSize({ width: 100, height: 100 }, spec);
  } catch (error) {
    return (error as Error).message;
  }
  return spec;
}

function ResizeOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<ResizeOptions>) {
  const first = files[0];
  const { error } = useImageSize(first, (source) => setOptions((o) => ({ ...o, source })));
  const spec = resizeSpec(options);
  const both = options.mode === "size" && options.width.trim() !== "" && options.height.trim() !== "";
  const format = resolveFormat(options.format, first.kind);

  let preview: string | null = null;
  if (options.source && typeof spec !== "string") {
    const target = targetSize(options.source, spec);
    preview = `${first.file.name}: ${options.source.width} × ${options.source.height} → ${target.width} × ${target.height}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <ChoiceGroup
        legend="Resize"
        name="resize-mode"
        value={options.mode}
        disabled={disabled}
        choices={[
          { value: "size", label: "By size" },
          { value: "percent", label: "By percentage" },
          { value: "preset", label: "For social media" },
        ]}
        onChange={(mode) => setOptions((o) => ({ ...o, mode }))}
      />
      {options.mode === "size" && (
        <>
          <div className="flex flex-wrap gap-4">
            {(["width", "height"] as const).map((side) => (
              <Field key={side} label={side === "width" ? "Width (px)" : "Height (px)"}>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Auto"
                  value={options[side]}
                  disabled={disabled}
                  onChange={(event) => setOptions((o) => ({ ...o, [side]: event.target.value }))}
                  className={`${inputClass} w-36`}
                />
              </Field>
            ))}
          </div>
          {both ? (
            <ChoiceGroup
              legend="Fit"
              name="resize-fit"
              value={options.fit}
              disabled={disabled}
              choices={[
                { value: "inside", label: "Keep proportions" },
                { value: "cover", label: "Crop to fill" },
                { value: "stretch", label: "Stretch" },
              ]}
              onChange={(fit) => setOptions((o) => ({ ...o, fit }))}
            />
          ) : (
            <p className="text-sm text-text-muted">Leave one side blank to keep the image&apos;s proportions.</p>
          )}
        </>
      )}
      {options.mode === "percent" && (
        <Field label={`Scale: ${options.percent}%`}>
          <input
            type="range"
            min={5}
            max={400}
            step={5}
            value={options.percent}
            disabled={disabled}
            onChange={(event) => setOptions((o) => ({ ...o, percent: event.target.valueAsNumber }))}
            className="max-w-sm accent-accent"
          />
        </Field>
      )}
      {options.mode === "preset" && (
        <Field label="Size" hint="Images are cropped from the center to fill the size exactly.">
          <select
            value={options.preset}
            disabled={disabled}
            onChange={(event) => setOptions((o) => ({ ...o, preset: event.target.value as PresetKey }))}
            className={`${inputClass} max-w-sm`}
          >
            {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
              <option key={key} value={key}>
                {PRESETS[key].label} · {PRESETS[key].width} × {PRESETS[key].height}
              </option>
            ))}
          </select>
        </Field>
      )}
      <FormatPicker
        value={options.format}
        allowKeep
        disabled={disabled}
        onChange={(value) => setOptions((o) => ({ ...o, format: value }))}
      />
      {usesQuality(format) && (
        <QualitySlider
          value={options.quality}
          disabled={disabled}
          onChange={(value) => setOptions((o) => ({ ...o, quality: value }))}
        />
      )}
      <p className="text-sm text-text-muted" aria-live="polite">
        {error ?? preview ?? (typeof spec === "string" ? "" : "Reading the image…")}
        {preview && files.length > 1 ? ` (the other ${files.length - 1} are resized the same way)` : ""}
      </p>
    </div>
  );
}

export const resizeImage = defineTool<ResizeOptions>({
  initialOptions: () => ({
    mode: "size",
    width: "",
    height: "",
    fit: "inside",
    percent: 50,
    preset: "instagram-square",
    format: "keep",
    quality: 90,
    source: null,
  }),
  Options: ResizeOptionsPanel,
  blocker: (_files, options) => {
    const spec = resizeSpec(options);
    if (typeof spec === "string") return spec;
    if (options.source) {
      const target = targetSize(options.source, spec);
      if (target.width * target.height > MAX_INPUT_PIXELS) return "That's larger than 50 MP. Choose a smaller size.";
    }
    return null;
  },
  async process(files, options, { signal, onProgress }) {
    const spec = resizeSpec(options);
    if (typeof spec === "string") throw new Error(spec);
    const formats = files.map((item) => resolveFormat(options.format, item.kind));
    const results = await processImages(
      files.map((item, i) => ({
        item,
        plan: { resize: spec, format: formats[i], quality: options.quality, maxOutputPixels: MAX_INPUT_PIXELS },
      })),
      { signal, onDone: (done) => onProgress({ done, total: files.length, unit: "images" }) },
    );
    return files.map(({ file }, i) => {
      const { width, height } = results[i].size;
      const name = `${stemOf(file.name)}-${width}x${height}.${OUTPUT_FORMATS[formats[i]].extension}`;
      return imageOutput(name, formats[i], results[i], file);
    });
  },
});
