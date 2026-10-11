import type { Size } from "@/lib/image/geometry";
import { ImageError, type ImagePlan, type ImageRequest, type ImageResponse, type ProcessResult } from "@/lib/image/types";
import type { AcceptedFile } from "@/lib/validate-files";

function abortError(): DOMException {
  return new DOMException("The operation was cancelled.", "AbortError");
}

function createWorker(): Worker {
  return new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
}

/** Sends one request to a worker and waits for its answer. */
function call<T>(worker: Worker, request: ImageRequest, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<ImageResponse>) => {
      signal.removeEventListener("abort", onAbort);
      const response = event.data;
      if (response.ok) resolve(response.result as T);
      else if (response.name === "ImageError") reject(new ImageError(response.message));
      else reject(new ImageError(`${request.name} couldn't be processed. It may be damaged.`));
    };
    worker.onerror = (event) => {
      signal.removeEventListener("abort", onAbort);
      event.preventDefault();
      reject(new ImageError(`${request.name} was too much for this browser. Try a smaller image.`));
    };
    worker.postMessage(request);
  });
}

export interface ImageJob {
  item: AcceptedFile;
  plan: ImagePlan;
}

/** How many images to work on at once: two, unless the device has a single core. */
function parallelism(): number {
  const cores = typeof navigator === "undefined" ? 2 : navigator.hardwareConcurrency || 2;
  return cores > 2 ? 2 : 1;
}

/**
 * Processes images in background workers, a couple at a time, and returns the
 * results in input order. Aborting terminates the workers at once.
 */
export async function processImages(
  jobs: readonly ImageJob[],
  { signal, onDone }: { signal: AbortSignal; onDone?: (done: number) => void },
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = new Array(jobs.length);
  const workers = Array.from({ length: Math.min(parallelism(), jobs.length) }, createWorker);
  let next = 0;
  let done = 0;
  try {
    await Promise.all(
      workers.map(async (worker) => {
        while (next < jobs.length) {
          const index = next++;
          const { item, plan } = jobs[index];
          results[index] = await call<ProcessResult>(
            worker,
            { op: "process", file: item.file, name: item.file.name, kind: item.kind, plan },
            signal,
          );
          onDone?.(++done);
        }
      }),
    );
  } finally {
    for (const worker of workers) worker.terminate();
  }
  return results;
}

/** Reads an image's pixel size, decoding it in a worker. */
export async function probeImage(item: AcceptedFile, signal: AbortSignal): Promise<Size> {
  const worker = createWorker();
  try {
    return await call<Size>(worker, { op: "probe", file: item.file, name: item.file.name, kind: item.kind }, signal);
  } finally {
    worker.terminate();
  }
}
