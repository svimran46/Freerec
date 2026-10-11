import { PDF_OPS, type PdfOpRequest, type PdfOpResponse } from "@/lib/pdf/ops";
import { transferables } from "@/lib/pdf/transfer";

self.onmessage = async (event: MessageEvent<PdfOpRequest>) => {
  const { op, args } = event.data;
  let response: PdfOpResponse;
  try {
    const run = PDF_OPS[op] as (...input: unknown[]) => Promise<unknown>;
    response = { ok: true, result: await run(...args) };
  } catch (error) {
    response = {
      ok: false,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(response, { transfer: response.ok ? transferables(response.result) : [] });
};
