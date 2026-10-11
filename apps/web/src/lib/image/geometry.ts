/** Largest image, in pixels, the tools will decode: 50 megapixels. */
export const MAX_INPUT_PIXELS = 50_000_000;

export interface Size {
  width: number;
  height: number;
}

/** How to size the output. */
export type ResizeSpec =
  /** Multiply both sides, e.g. 0.5 or 4. */
  | { mode: "scale"; factor: number }
  /**
   * Fit a box. With one side missing, the other follows the aspect ratio.
   * "inside" keeps proportions within the box, "cover" crops to fill it,
   * "stretch" fills it exactly.
   */
  | { mode: "box"; width: number | null; height: number | null; fit: "inside" | "cover" | "stretch" };

/** The output size for a source image, or a RangeError explaining why there is none. */
export function targetSize(source: Size, spec: ResizeSpec): Size {
  const round = (n: number) => Math.max(1, Math.round(n));
  if (spec.mode === "scale") {
    if (!(spec.factor > 0)) throw new RangeError("Enter a size above 0%.");
    return { width: round(source.width * spec.factor), height: round(source.height * spec.factor) };
  }
  const { width, height, fit } = spec;
  for (const side of [width, height]) {
    if (side !== null && !(Number.isInteger(side) && side > 0)) {
      throw new RangeError("Enter sizes as whole numbers of pixels.");
    }
  }
  if (width === null && height === null) throw new RangeError("Enter a width, a height, or both.");
  if (width === null) return { width: round((source.width * height!) / source.height), height: height! };
  if (height === null) return { width, height: round((source.height * width) / source.width) };
  if (fit === "inside") {
    const scale = Math.min(width / source.width, height / source.height);
    return { width: round(source.width * scale), height: round(source.height * scale) };
  }
  return { width, height };
}

/** The centered region of `source` with the target's aspect ratio, for "cover" fits. */
export function coverCrop(source: Size, target: Size): { x: number; y: number } & Size {
  const scale = Math.max(target.width / source.width, target.height / source.height);
  const width = Math.min(source.width, Math.round(target.width / scale));
  const height = Math.min(source.height, Math.round(target.height / scale));
  return {
    x: Math.floor((source.width - width) / 2),
    y: Math.floor((source.height - height) / 2),
    width,
    height,
  };
}

export function megapixels({ width, height }: Size): string {
  const mp = (width * height) / 1_000_000;
  return `${mp < 10 ? mp.toFixed(1) : Math.round(mp)} MP`;
}

/** Largest input, in pixels, for each upscale factor; both cap the output near 16 MP. */
export const UPSCALE_LIMITS: Record<2 | 4, number> = { 2: 4_000_000, 4: 1_000_000 };
