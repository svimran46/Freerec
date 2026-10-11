"use client";

import { useEffect, useState } from "react";
import { CompareSlider } from "@/components/CompareSlider";
import { Field, inputClass } from "@/components/form";
import type { OutputFile } from "@/lib/download";
import { stemOf, type FileKind } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/format";
import { processImages } from "@/lib/image/client";
import { OUTPUT_FORMATS, resolveFormat, usesQuality, type FormatChoice, type OutputFormat } from "@/lib/image/formats";
import type { ProcessResult } from "@/lib/image/types";
import type { AcceptedFile } from "@/lib/validate-files";
import { defineTool, type OptionsProps } from "@/tools/types";
import { FormatPicker, imageOutput, QualitySlider, sizeChange } from "@/tools/client/image-shared";

interface CompressOptions {
  format: FormatChoice;
  quality: number;
  /** The file shown in the preview; the first one when null. */
  previewId: string | null;
}

/** Kinds every browser can show in an <img>, so the preview can compare against the original. */
const DISPLAYABLE: readonly FileKind[] = ["jpeg", "png", "webp", "gif", "avif", "bmp"];

/**
 * Recent results, so running the tool reuses what the preview already encoded.
 * Keys combine the file, format, and quality.
 */
const recent = new Map<string, ProcessResult>();
const RECENT_LIMIT = 8;

function plan(item: AcceptedFile, options: Pick<CompressOptions, "format" | "quality">) {
  const format = resolveFormat(options.format, item.kind);
  const quality = usesQuality(format) ? options.quality : 0;
  return { format, quality, key: `${item.id}|${format}|${quality}` };
}

function remember(key: string, result: ProcessResult) {
  recent.delete(key);
  recent.set(key, result);
  if (recent.size > RECENT_LIMIT) recent.delete(recent.keys().next().value!);
}

interface PreviewState {
  key: string;
  result?: ProcessResult;
  url?: string;
  error?: string;
}

function Preview({ item, format, quality, cacheKey }: { item: AcceptedFile; format: OutputFormat; quality: number; cacheKey: string }) {
  const [original] = useState(() => (DISPLAYABLE.includes(item.kind) ? URL.createObjectURL(item.file) : null));
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => () => {
    if (original) URL.revokeObjectURL(original);
  }, [original]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = recent.get(cacheKey);
    // Wait for the slider to settle before encoding.
    const timer = setTimeout(
      async () => {
        try {
          const result = cached ?? (await processImages([{ item, plan: { format, quality } }], { signal: controller.signal }))[0];
          remember(cacheKey, result);
          const url = URL.createObjectURL(new Blob([result.bytes], { type: OUTPUT_FORMATS[format].mime }));
          setState({ key: cacheKey, result, url });
        } catch (error) {
          if (!controller.signal.aborted) {
            setState({ key: cacheKey, error: error instanceof Error ? error.message : String(error) });
          }
        }
      },
      cached ? 0 : 400,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [item, format, quality, cacheKey]);

  useEffect(() => () => {
    if (state?.url) URL.revokeObjectURL(state.url);
  }, [state?.url]);

  const current = state?.key === cacheKey ? state : null;
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="text-sm">
        <span className="text-text-muted">Original {formatBytes(item.file.size)} → </span>
        {current?.result ? (
          <span className="font-medium">{sizeChange(item.file.size, current.result.bytes.byteLength)}</span>
        ) : current?.error ? (
          <span className="text-danger">{current.error}</span>
        ) : (
          <span className="text-text-muted">estimating…</span>
        )}
      </p>
      {state?.url && state.result && (
        <div className={current ? "" : "opacity-50"}>
          {original ? (
            <CompareSlider before={original} after={state.url} aspect={state.result.size.width / state.result.size.height} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img src={state.url} alt="Compressed preview" className="mx-auto max-h-96 rounded-lg border border-border" />
          )}
        </div>
      )}
    </div>
  );
}

function CompressOptionsPanel({ files, options, setOptions, disabled }: OptionsProps<CompressOptions>) {
  const item = files.find((f) => f.id === options.previewId) ?? files[0];
  const { format, quality, key } = plan(item, options);
  const showQuality = options.format !== "png";

  return (
    <div className="flex flex-col gap-5">
      <FormatPicker
        value={options.format}
        allowKeep
        disabled={disabled}
        onChange={(value) => setOptions((o) => ({ ...o, format: value }))}
      />
      {showQuality && (
        <QualitySlider
          value={options.quality}
          disabled={disabled}
          hint={
            options.format === "keep" && files.some((f) => resolveFormat("keep", f.kind) === "png")
              ? "Lower quality makes smaller files. PNGs stay lossless and are optimized instead."
              : "Lower quality makes smaller files. 60–80 suits most photos."
          }
          onChange={(value) => setOptions((o) => ({ ...o, quality: value }))}
        />
      )}
      {!showQuality && (
        <p className="text-sm text-text-muted">
          PNG is lossless: files are optimized without changing a pixel. For much smaller files, choose WebP or JPG.
        </p>
      )}
      <section aria-label="Preview" className="flex flex-col gap-3 border-t border-border pt-4">
        {files.length > 1 && (
          <Field label="Preview">
            <select
              value={item.id}
              disabled={disabled}
              onChange={(event) => setOptions((o) => ({ ...o, previewId: event.target.value }))}
              className={`${inputClass} max-w-sm`}
            >
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.file.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Preview key={item.id} item={item} format={format} quality={quality} cacheKey={key} />
      </section>
    </div>
  );
}

export const compressImage = defineTool<CompressOptions>({
  initialOptions: () => ({ format: "keep", quality: 75, previewId: null }),
  Options: CompressOptionsPanel,
  async process(files, options, { signal, onProgress }) {
    const plans = files.map((item) => plan(item, options));
    const results: (ProcessResult | undefined)[] = plans.map((p) => recent.get(p.key));
    const pending = files.flatMap((item, i) => (results[i] ? [] : [i]));
    const cached = files.length - pending.length;
    onProgress({ done: cached, total: files.length, unit: "images" });
    const fresh = await processImages(
      pending.map((i) => ({ item: files[i], plan: { format: plans[i].format, quality: plans[i].quality } })),
      { signal, onDone: (done) => onProgress({ done: cached + done, total: files.length, unit: "images" }) },
    );
    pending.forEach((index, i) => {
      results[index] = fresh[i];
      remember(plans[index].key, fresh[i]);
    });

    return files.map(({ file, kind }, i): OutputFile => {
      const { format } = plans[i];
      const result = results[i]!;
      if (format === kind && result.bytes.byteLength >= file.size) {
        return { name: file.name, data: file, detail: `Already compact, so the original is kept · ${formatBytes(file.size)}` };
      }
      return imageOutput(`${stemOf(file.name)}.${OUTPUT_FORMATS[format].extension}`, format, result, file);
    });
  },
});
