// The parts of libheif-js's JavaScript API the image worker uses.
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    /** Decodes into `target` (RGBA), applying the image's rotation and mirroring. */
    display(target: ImageData, callback: (result: ImageData | null) => void): void;
    free(): void;
  }
  interface LibHeif {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
  }
  const createLibheif: (options?: object) => LibHeif | Promise<LibHeif>;
  export default createLibheif;
}
