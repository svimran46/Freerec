import type { OutputFile } from "@/lib/download";
import type { NamedBytes } from "@/lib/pdf/types";

export async function readFile(file: File): Promise<NamedBytes> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export function pdfOutput(name: string, bytes: Uint8Array): OutputFile {
  return { name, data: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }) };
}
