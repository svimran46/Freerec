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
): Promise<CreatedJob> {
  return request(CreatedJob, BASE, {
    method: "POST",
    body: JSON.stringify({
      tool,
      files: files.map((f) => ({ name: f.name, size: f.size })),
      options,
    }),
  });
}

export async function uploadFile(
  upload: z.infer<typeof PresignedUpload>,
  file: File,
): Promise<void> {
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
  form.append("file", file);
  const res = await fetch(upload.url, { method: "POST", body: form });
  if (!res.ok) throw new JobError(`Upload of ${file.name} failed (${res.status}).`, res.status);
}

export function submitJob(id: string): Promise<Job> {
  return request(Job, `${BASE}/${encodeURIComponent(id)}/submit`, { method: "POST" });
}

export function getJob(id: string): Promise<Job> {
  return request(Job, `${BASE}/${encodeURIComponent(id)}`);
}

const TERMINAL: ReadonlySet<JobStatus> = new Set(["done", "failed", "expired"]);

/** Polls until the job reaches a terminal state or the signal aborts. */
export async function waitForJob(
  id: string,
  { intervalMs = 1000, signal }: { intervalMs?: number; signal?: AbortSignal } = {},
): Promise<Job> {
  for (;;) {
    signal?.throwIfAborted();
    const job = await getJob(id);
    if (TERMINAL.has(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** Runs a server tool end to end and returns the finished job. */
export async function runServerJob(
  tool: string,
  files: readonly File[],
  options: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<Job> {
  const created = await createJob(tool, files, options);
  await Promise.all(created.uploads.map((upload, i) => uploadFile(upload, files[i])));
  await submitJob(created.id);
  const job = await waitForJob(created.id, { signal });
  if (job.status !== "done") throw new JobError(job.error ?? `Job ${job.status}.`);
  return job;
}
