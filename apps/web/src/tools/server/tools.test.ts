import { afterEach, describe, expect, it, vi } from "vitest";
import type { AcceptedFile } from "@/lib/validate-files";
import { compressPdf, ebookConverter, htmlToPdf } from "@/tools/server/tools";
import type { Progress } from "@/tools/types";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const pdf = (size: number): AcceptedFile => ({
  id: "f1",
  file: new File([new Uint8Array(size)], "report.pdf", { type: "application/pdf" }),
  kind: "pdf",
});

/** A backend that finishes the job on the first poll and returns `output`. */
function fakeBackend(output: Uint8Array<ArrayBuffer>, { deleteStatus = 204 } = {}) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const done = {
    id: "j1",
    tool: "compress-pdf",
    status: "done",
    error: null,
    outputs: [{ name: "report-compressed.pdf", size: output.byteLength, url: "https://s3/out" }],
    expires_at: "x",
  };
  vi.stubGlobal("XMLHttpRequest", undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
      if (url === "/api/jobs") {
        return json({ id: "j1", status: "created", uploads: [{ url: "https://s3/in", fields: {} }], expires_at: "x" }, 201);
      }
      if (url === "https://s3/in") return new Response(null, { status: 204 });
      if (url === "/api/jobs/j1/submit") return json({ ...done, status: "queued", outputs: [] }, 202);
      if (url === "https://s3/out") return new Response(output);
      if (method === "DELETE") return new Response(null, { status: deleteStatus });
      return json(done);
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("server tools", () => {
  it("send their options, download the result, and delete the job", async () => {
    const calls = fakeBackend(new Uint8Array(250));
    const progress: Progress[] = [];
    const [output] = await compressPdf.process([pdf(1000)], { level: "small" }, {
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p),
    });

    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "/api/jobs",
      body: { tool: "compress-pdf", files: [{ name: "report.pdf", size: 1000 }], options: { level: "small" } },
    });
    expect(calls.at(-1)).toEqual({ method: "DELETE", url: "/api/jobs/j1", body: undefined });
    expect(output.name).toBe("report-compressed.pdf");
    expect(output.data.size).toBe(250);
    expect(output.detail).toBe("250 B, 75% smaller · deleted from our servers");
    expect(progress).toContainEqual({ label: "Downloading the result…" });
  });

  it("say when the original was already smaller, and when deletion is left to the janitor", async () => {
    fakeBackend(new Uint8Array(1000), { deleteStatus: 503 });
    const [output] = await compressPdf.process([pdf(1000)], { level: "balanced" }, {
      signal: new AbortController().signal,
      onProgress: () => {},
    });
    expect(output.detail).toBe(
      "Already compact, so the original is kept · deleted from our servers within 60 minutes",
    );
  });

  it("map their settings to the API's names", async () => {
    const calls = fakeBackend(new TextEncoder().encode("%PDF") as Uint8Array<ArrayBuffer>);
    const html: AcceptedFile = { id: "h", file: new File(["<p>hi</p>"], "page.html"), kind: "html" };
    await htmlToPdf.process([html], { pageSize: "letter", landscape: true, margin: "none" }, {
      signal: new AbortController().signal,
      onProgress: () => {},
    });
    expect(calls[0].body).toMatchObject({ options: { page_size: "letter", landscape: true, margin: "none" } });
  });

  it("won't convert an ebook to its own format", () => {
    const epub: AcceptedFile = { id: "e", file: new File(["x"], "book.epub"), kind: "epub" };
    expect(ebookConverter.initialOptions([epub])).toEqual({ output: "pdf" });
    expect(ebookConverter.blocker?.([epub], { output: "epub" })).toBe("It's already EPUB. Choose another format.");
    expect(ebookConverter.blocker?.([epub], { output: "mobi" })).toBeNull();
  });
});
