import { zip, type Zippable } from "fflate";

export interface OutputFile {
  name: string;
  data: Blob;
}

/** Saves a blob through a temporary object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Makes names unique by suffixing duplicates: a.pdf, a (2).pdf, a (3).pdf. */
export function dedupeNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    return `${stem} (${count})${ext}`;
  });
}

/**
 * Bundles outputs into a ZIP. Entries are stored without recompression because
 * PDFs and images are already compressed.
 */
export async function zipFiles(files: readonly OutputFile[]): Promise<Blob> {
  const names = dedupeNames(files.map((f) => f.name));
  const entries: Zippable = {};
  await Promise.all(
    files.map(async (file, i) => {
      entries[names[i]] = [new Uint8Array(await file.data.arrayBuffer()), { level: 0 }];
    }),
  );
  const bytes = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, (err, data) => (err ? reject(err) : resolve(data))),
  );
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}

/** Downloads one output directly, or several as a single ZIP. */
export async function downloadOutputs(files: readonly OutputFile[], zipName: string): Promise<void> {
  if (files.length === 0) return;
  if (files.length === 1) {
    downloadBlob(files[0].data, files[0].name);
    return;
  }
  downloadBlob(await zipFiles(files), zipName);
}
