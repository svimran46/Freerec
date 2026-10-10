import { afterEach, describe, expect, it, vi } from "vitest";
import { JobError, runServerJob } from "./jobs";

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

    const result = await runServerJob("compress-pdf", [new File(["%PDF"], "a.pdf")], {}, undefined);
    expect(result.outputs).toEqual([{ name: "a.pdf", size: 3, url: "u" }]);
    expect(calls.slice(0, 3)).toEqual([
      "POST /api/jobs",
      "POST http://s3/bucket",
      "POST /api/jobs/j1/submit",
    ]);
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
});
