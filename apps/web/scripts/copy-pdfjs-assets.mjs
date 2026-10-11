// Copies the files pdf.js fetches at runtime (CMaps, standard fonts, image
// decoders, ICC profiles) into public/pdfjs so they're served with the app and
// always match the installed pdfjs-dist version.
import { cpSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");

rmSync(target, { recursive: true, force: true });
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(join(source, dir), join(target, dir), { recursive: true });
}
