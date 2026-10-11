/**
 * File kind detection by magic bytes. Extensions are only trusted to pick
 * between formats that share a container (ZIP, OLE, MOBI) — the server
 * re-validates every upload, so this is a UX guard, not a security boundary.
 */

export const FILE_KINDS = {
  pdf: { label: "PDF", extensions: [".pdf"], mime: "application/pdf" },
  jpeg: { label: "JPG", extensions: [".jpg", ".jpeg"], mime: "image/jpeg" },
  png: { label: "PNG", extensions: [".png"], mime: "image/png" },
  webp: { label: "WebP", extensions: [".webp"], mime: "image/webp" },
  gif: { label: "GIF", extensions: [".gif"], mime: "image/gif" },
  avif: { label: "AVIF", extensions: [".avif"], mime: "image/avif" },
  heic: { label: "HEIC", extensions: [".heic", ".heif"], mime: "image/heic" },
  bmp: { label: "BMP", extensions: [".bmp"], mime: "image/bmp" },
  tiff: { label: "TIFF", extensions: [".tif", ".tiff"], mime: "image/tiff" },
  docx: {
    label: "Word",
    extensions: [".docx"],
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  xlsx: {
    label: "Excel",
    extensions: [".xlsx"],
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  pptx: {
    label: "PowerPoint",
    extensions: [".pptx"],
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  doc: { label: "Word 97", extensions: [".doc"], mime: "application/msword" },
  xls: { label: "Excel 97", extensions: [".xls"], mime: "application/vnd.ms-excel" },
  ppt: { label: "PowerPoint 97", extensions: [".ppt"], mime: "application/vnd.ms-powerpoint" },
  odt: { label: "ODT", extensions: [".odt"], mime: "application/vnd.oasis.opendocument.text" },
  ods: {
    label: "ODS",
    extensions: [".ods"],
    mime: "application/vnd.oasis.opendocument.spreadsheet",
  },
  odp: {
    label: "ODP",
    extensions: [".odp"],
    mime: "application/vnd.oasis.opendocument.presentation",
  },
  rtf: { label: "RTF", extensions: [".rtf"], mime: "application/rtf" },
  txt: { label: "Text", extensions: [".txt"], mime: "text/plain" },
  html: { label: "HTML", extensions: [".html", ".htm"], mime: "text/html" },
  epub: { label: "EPUB", extensions: [".epub"], mime: "application/epub+zip" },
  mobi: { label: "MOBI", extensions: [".mobi"], mime: "application/x-mobipocket-ebook" },
  azw3: { label: "AZW3", extensions: [".azw3", ".azw"], mime: "application/vnd.amazon.ebook" },
} as const satisfies Record<string, { label: string; extensions: string[]; mime: string }>;

export type FileKind = keyof typeof FILE_KINDS;

/** Number of leading bytes {@link detectKind} needs. */
export const SNIFF_BYTES = 68;

const ZIP_KINDS: FileKind[] = ["docx", "xlsx", "pptx", "odt", "ods", "odp", "epub"];
const OLE_KINDS: FileKind[] = ["doc", "xls", "ppt"];
const MOBI_KINDS: FileKind[] = ["mobi", "azw3"];
const TEXT_KINDS: FileKind[] = ["txt", "html", "rtf"];

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/** The file name without its extension: "report.final.pdf" → "report.final". */
export function stemOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

export function kindFromExtension(filename: string): FileKind | null {
  const ext = extensionOf(filename);
  for (const [kind, info] of Object.entries(FILE_KINDS)) {
    if ((info.extensions as readonly string[]).includes(ext)) return kind as FileKind;
  }
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

function pickByExtension(candidates: FileKind[], filename: string): FileKind | null {
  const fromExt = kindFromExtension(filename);
  return fromExt && candidates.includes(fromExt) ? fromExt : null;
}

/** Detects a file's kind from its first {@link SNIFF_BYTES} bytes and its name. */
export function detectKind(bytes: Uint8Array, filename: string): FileKind | null {
  // PDFs may have up to 1 KB of junk before the header; 68 bytes covers the common case.
  if (ascii(bytes, 0, Math.min(bytes.length, SNIFF_BYTES)).includes("%PDF-")) return "pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (ascii(bytes, 0, 4) === "GIF8") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 0, 2) === "BM") return "bmp";
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "heic";
    return null;
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // EPUB requires an uncompressed "mimetype" entry first, so its value is readable here.
    if (ascii(bytes, 30, 58) === "mimetypeapplication/epub+zip") return "epub";
    return pickByExtension(ZIP_KINDS, filename);
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return pickByExtension(OLE_KINDS, filename);
  }
  if (ascii(bytes, 60, 68) === "BOOKMOBI") return pickByExtension(MOBI_KINDS, filename) ?? "mobi";
  if (ascii(bytes, 0, 5) === "{\\rtf") return "rtf";
  if (bytes.length > 0 && !bytes.includes(0)) return pickByExtension(TEXT_KINDS, filename);
  return null;
}

/** Value for an `<input type="file" accept>` attribute covering the given kinds. */
export function acceptAttribute(kinds: readonly FileKind[]): string {
  return kinds
    .flatMap((kind) => [FILE_KINDS[kind].mime, ...FILE_KINDS[kind].extensions])
    .join(",");
}
