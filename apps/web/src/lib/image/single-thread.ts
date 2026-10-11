/**
 * Single-threaded builds of the AVIF and OxiPNG encoders. The packages' entry
 * points also pull in multi-threaded builds whose workers import themselves,
 * which hangs the Turbopack build, and threads need cross-origin isolation the
 * site doesn't enable anyway. Runs only inside image.worker.ts.
 */
import type { AVIFModule, EncodeOptions as AvifEncodeOptions } from "@jsquash/avif/codec/enc/avif_enc.js";

let avif: Promise<AVIFModule> | null = null;
let oxipng: Promise<unknown> | null = null;

export async function encodeAvif(image: ImageData, options: Partial<AvifEncodeOptions>): Promise<ArrayBuffer> {
  const [{ default: factory }, { initEmscriptenModule }, { defaultOptions }] = await Promise.all([
    import("@jsquash/avif/codec/enc/avif_enc.js"),
    import("@jsquash/avif/utils.js"),
    import("@jsquash/avif/meta.js"),
  ]);
  avif ??= initEmscriptenModule(factory);
  const output = (await avif).encode(new Uint8Array(image.data.buffer), image.width, image.height, {
    ...defaultOptions,
    ...options,
  });
  if (!output) throw new Error("AVIF encoding failed.");
  return output.buffer as ArrayBuffer;
}

export async function optimisePng(image: ImageData, level: number): Promise<ArrayBuffer> {
  const { default: init, optimise_raw } = await import("@jsquash/oxipng/codec/pkg/squoosh_oxipng.js");
  oxipng ??= init();
  await oxipng;
  return optimise_raw(new Uint8ClampedArray(image.data), image.width, image.height, level, false, true)
    .buffer as ArrayBuffer;
}
