import type { PdfOpName, PdfOpResponse, PdfOps } from "@/lib/pdf/ops";
import { transferables } from "@/lib/pdf/transfer";
import { PdfError } from "@/lib/pdf/types";

function abortError(): DOMException {
  return new DOMException("The operation was cancelled.", "AbortError");
}

/**
 * Runs a PDF edit in a dedicated worker so large files don't freeze the page.
 * Aborting terminates the worker, which stops the work at once. Input buffers are
 * transferred to the worker and can't be used afterwards. Where workers are
 * unavailable (tests), the edit runs inline.
 */
export function runPdfOp<K extends PdfOpName>(
  op: K,
  args: Parameters<PdfOps[K]>,
  signal: AbortSignal,
): ReturnType<PdfOps[K]> {
  if (typeof Worker === "undefined") {
    return import("@/lib/pdf/ops").then(({ PDF_OPS }) => {
      const run = PDF_OPS[op] as (...input: unknown[]) => Promise<unknown>;
      return run(...args);
    }) as ReturnType<PdfOps[K]>;
  }
  return new Promise<unknown>((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
    const finish = () => {
      worker.terminate();
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      finish();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<PdfOpResponse>) => {
      finish();
      const response = event.data;
      if (response.ok) resolve(response.result);
      else if (response.name === "PdfError") reject(new PdfError(response.message));
      else reject(new Error(response.message));
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "The PDF tool stopped unexpectedly."));
    };
    worker.postMessage({ op, args }, transferables(args));
  }) as ReturnType<PdfOps[K]>;
}
