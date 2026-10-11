import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteJob, fetchOutputs, JobError, runServerJob, type Job } from "./jobs";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const job = (status: string, extra: object = {}) => ({
  id: "j1",
  tool: "compress-pdf",
  status,
  error: null,
  outputs: [],
  expires_at: "2026-10-10T07:00:00Z",
  ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe("runServerJob", () => {
  it("creates, uploads, submits, and polls until done", async () => {
    // Without XMLHttpRequest, uploads go through fetch, which the test stubs.
    vi.stubGlobal("XMLHttpRequest", undefined);
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/jobs") {
          return json(
            {
              id: "j1",
              status: "created",
              uploads: [{ url: "http://s3/bucket", fields: { key: "jobs/j1/in/0" } }],
              expires_at: "2026-10-10T07:00:00Z",
            },
            201,
          );
        }
        if (url === "http://s3/bucket") {
          const form = init?.body as FormData;
          expect(form.get("key")).toBe("jobs/j1/in/0");
          expect(form.get("file")).toBeInstanceOf(File);
          return new Response(null, { status: 204 });
        }
        if (url === "/api/jobs/j1/submit") return json(job("queued"), 202);
        const polls = calls.filter((c) => c === "GET /api/jobs/j1").length;
        return json(
          polls < 2 ? job("running") : job("done", { outputs: [{ name: "a.pdf", size: 3, url: "u" }] }),
        );
      }),
    );

    const phases: string[] = [];
    const result = await runServerJob("compress-pdf", [new File(["%PDF"], "a.pdf")], {}, {
      onPhase: (p) => phases.push(p.phase),
    });
    expect(result.outputs).toEqual([{ name: "a.pdf", size: 3, url: "u" }]);
    expect(calls.slice(0, 3)).toEqual([
      "POST /api/jobs",
      "POST http://s3/bucket",
      "POST /api/jobs/j1/submit",
    ]);
    expect(phases).toEqual(["queued", "running"]);
  }, 10_000);

  it("surfaces the backend's error detail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ detail: "Unknown tool." }, 400)));
    const error = await runServerJob("nope", [new File(["x"], "a")]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JobError);
    expect(error).toMatchObject({ message: "Unknown tool.", status: 400 });
  });

  it("throws when the job fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/jobs") {
          return json({ id: "j1", status: "created", uploads: [], expires_at: "x" }, 201);
        }
        return json(job("failed", { error: "File is damaged." }));
      }),
    );
    await expect(runServerJob("compress-pdf", [])).rejects.toThrow("File is damaged.");
  });

  it("deletes the job when it fails or is cancelled", async () => {
    const deletes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          deletes.push(url);
          return new Response(null, { status: 204 });
        }
        if (url === "/api/jobs") {
          return json({ id: "j1", status: "created", uploads: [], expires_at: "x" }, 201);
        }
        if (url === "/api/jobs/j1/submit") return json(job("queued"), 202);
        return json(job("running"));
      }),
    );
    const controller = new AbortController();
    const running = runServerJob("compress-pdf", [], {}, {
      signal: controller.signal,
      onPhase: (p) => p.phase === "running" && controller.abort(),
    });
    await expect(running).rejects.toThrow("cancelled");
    expect(deletes).toEqual(["/api/jobs/j1"]);
  });
});

describe("fetchOutputs and deleteJob", () => {
  it("downloads outputs into blobs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF", { status: 200 })));
    const done = job("done", { outputs: [{ name: "a.pdf", size: 4, url: "u" }] }) as Job;
    const [output] = await fetchOutputs(done);
    expect(output.name).toBe("a.pdf");
    expect(await output.data.text()).toBe("%PDF");
  });

  it("reports whether the job was deleted", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect(await deleteJob("j1")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    expect(await deleteJob("j1")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await deleteJob("j1")).toBe(false);
  });
});
