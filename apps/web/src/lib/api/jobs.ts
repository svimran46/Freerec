import { z } from "zod";

/**
 * Client for server-processed tools. The browser talks to the Next.js `/api/jobs`
 * route handlers, which forward to the FastAPI service (see services/backend).
 *
 * Flow: createJob → upload each file to its presigned POST → submitJob → poll getJob.
 */

export const JobStatus = z.enum(["created", "queued", "running", "done", "failed", "expired"]);
export type JobStatus = z.infer<typeof JobStatus>;

const PresignedUpload = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
});

const CreatedJob = z.object({
  id: z.string(),
  status: JobStatus,
  uploads: z.array(PresignedUpload),
  expires_at: z.string(),
});
export type CreatedJob = z.infer<typeof CreatedJob>;

const JobOutput = z.object({ name: z.string(), size: z.number(), url: z.string() });

const Job = z.object({
  id: z.string(),
  tool: z.string(),
  status: JobStatus,
  error: z.string().nullable(),
  outputs: z.array(JobOutput),
  expires_at: z.string(),
});
export type Job = z.infer<typeof Job>;

export class JobError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "JobError";
  }
}

const BASE = "/api/jobs";

function abortError(): DOMException {
  return new DOMException("The operation was cancelled.", "AbortError");
}

async function request<T>(schema: z.ZodType<T>, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
        ? body.detail
        : `Request failed (${res.status}).`;
    throw new JobError(detail, res.status);
  }
  return schema.parse(body);
}

export function createJob(
  tool: string,
  files: readonly File[],
  options: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<CreatedJob> {
  return request(CreatedJob, BASE, {
    method: "POST",
    body: JSON.stringify({
      tool,
      files: files.map((f) => ({ name: f.name, size: f.size })),
      options,
    }),
    signal,
  });
}

function uploadForm(upload: z.infer<typeof PresignedUpload>, file: File): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
  form.append("file", file);
  return form;
}

/**
 * Uploads a file to its presigned POST. With `onProgress` it uses XMLHttpRequest,
 * the only browser API that reports upload progress.
 */
export async function uploadFile(
  upload: z.infer<typeof PresignedUpload>,
  file: File,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (sent: number) => void } = {},
): Promise<void> {
  const failed = (status?: number) =>
    new JobError(
      status ? `Upload of ${file.name} failed (${status}).` : `Upload of ${file.name} failed. Check your connection.`,
      status,
    );
  if (!onProgress || typeof XMLHttpRequest === "undefined") {
    const res = await fetch(upload.url, { method: "POST", body: uploadForm(upload, file), signal });
    if (!res.ok) throw failed(res.status);
    return;
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", upload.url);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(failed(xhr.status)));
    xhr.onerror = () => reject(failed());
    xhr.onabort = () => reject(abortError());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(uploadForm(upload, file));
  });
}

export function submitJob(id: string, signal?: AbortSignal): Promise<Job> {
  return request(Job, `${BASE}/${encodeURIComponent(id)}/submit`, { method: "POST", signal });
}

export function getJob(id: string, signal?: AbortSignal): Promise<Job> {
  return request(Job, `${BASE}/${encodeURIComponent(id)}`, { signal });
}

/** Deletes a job's files from storage now. Returns whether the server confirmed it. */
export async function deleteJob(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const TERMINAL: ReadonlySet<JobStatus> = new Set(["done", "failed", "expired"]);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

/** Polls until the job reaches a terminal state or the signal aborts. */
export async function waitForJob(
  id: string,
  {
    intervalMs = 1000,
    signal,
    onStatus,
  }: { intervalMs?: number; signal?: AbortSignal; onStatus?: (status: JobStatus) => void } = {},
): Promise<Job> {
  for (;;) {
    signal?.throwIfAborted();
    const job = await getJob(id, signal);
    onStatus?.(job.status);
    if (TERMINAL.has(job.status)) return job;
    await sleep(intervalMs, signal);
  }
}

/** Where a server job is, for progress messages. */
export type JobPhase =
  | { phase: "uploading"; sent: number; total: number }
  | { phase: "queued" }
  | { phase: "running" };

/**
 * Runs a server tool end to end and returns the finished job. If anything fails or
 * the signal aborts after the job exists, the job and its files are deleted.
 */
export async function runServerJob(
  tool: string,
  files: readonly File[],
  options: Record<string, unknown> = {},
  { signal, onPhase }: { signal?: AbortSignal; onPhase?: (phase: JobPhase) => void } = {},
): Promise<Job> {
  const created = await createJob(tool, files, options, signal);
  try {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    const sent = files.map(() => 0);
    await Promise.all(
      created.uploads.map((upload, i) =>
        uploadFile(upload, files[i], {
          signal,
          onProgress: onPhase
            ? (bytes) => {
                sent[i] = bytes;
                onPhase({ phase: "uploading", sent: sent.reduce((a, b) => a + b, 0), total });
              }
            : undefined,
        }),
      ),
    );
    onPhase?.({ phase: "queued" });
    await submitJob(created.id, signal);
    const job = await waitForJob(created.id, {
      signal,
      onStatus: (status) => {
        if (status === "queued" || status === "running") onPhase?.({ phase: status });
      },
    });
    if (job.status !== "done") throw new JobError(job.error ?? `Job ${job.status}.`);
    return job;
  } catch (error) {
    void deleteJob(created.id);
    throw error;
  }
}

/** Downloads a finished job's outputs into the browser. */
export async function fetchOutputs(job: Job, signal?: AbortSignal): Promise<{ name: string; data: Blob }[]> {
  return Promise.all(
    job.outputs.map(async (output) => {
      const res = await fetch(output.url, { signal });
      if (!res.ok) throw new JobError(`Downloading ${output.name} failed (${res.status}).`, res.status);
      return { name: output.name, data: await res.blob() };
    }),
  );
}
