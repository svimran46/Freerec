import { describe, expect, it, vi } from "vitest";
import type { FileKind } from "@/lib/file-kinds";
import type { AcceptedFile } from "@/lib/validate-files";
import { blobBytes, JPEG_4X2, numberedPdf, pageNumbers, pageRotations, pdfFile, PNG_4X2 } from "@/test/fixtures";
import { IMPLEMENTATIONS } from "@/tools/implementations";
import type { AnyToolImplementation, RunContext } from "@/tools/types";

let nextId = 0;
const accepted = (file: File, kind: FileKind = "pdf"): AcceptedFile => ({ id: `t${++nextId}`, file, kind });
const context = (): RunContext => ({ signal: new AbortController().signal, onProgress: vi.fn() });

function tool(slug: string): AnyToolImplementation {
  const implementation = IMPLEMENTATIONS[slug];
  if (!implementation) throw new Error(`No implementation for ${slug}`);
  return implementation;
}

/** Runs a tool with its initial options plus overrides, after checking it isn't blocked. */
async function run(slug: string, files: AcceptedFile[], overrides: object) {
  const implementation = tool(slug);
  const options = { ...(implementation.initialOptions(files) as object), ...overrides };
  expect(implementation.blocker?.(files, options) ?? null).toBeNull();
  return implementation.process(files, options, context());
}

const blocker = (slug: string, files: AcceptedFile[], overrides: object) => {
  const implementation = tool(slug);
  return implementation.blocker?.(files, { ...(implementation.initialOptions(files) as object), ...overrides });
};

describe("merge-pdf", () => {
  it("needs two files and keeps their order", async () => {
    const files = [accepted(pdfFile(await numberedPdf(1), "a.pdf")), accepted(pdfFile(await numberedPdf(3), "b.pdf"))];
    expect(blocker("merge-pdf", files.slice(0, 1), {})).toMatch("at least two PDFs");
    const [output] = await run("merge-pdf", [files[1], files[0]], {});
    expect(output.name).toBe("merged.pdf");
    expect(output.data.type).toBe("application/pdf");
    expect(await pageNumbers(await blobBytes(output.data))).toEqual([1, 2, 3, 1]);
  });
});

describe("split-pdf", () => {
  it("writes one PDF per range", async () => {
    const files = [accepted(pdfFile(await numberedPdf(5), "report.pdf"))];
    const outputs = await run("split-pdf", files, { pageCount: 5, ranges: "1-2, 3-" });
    expect(outputs.map((o) => o.name)).toEqual(["report-pages-1-2.pdf", "report-pages-3-5.pdf"]);
    expect(await pageNumbers(await blobBytes(outputs[1].data))).toEqual([3, 4, 5]);
  });

  it("splits every few pages", async () => {
    const files = [accepted(pdfFile(await numberedPdf(5), "report.pdf"))];
    const outputs = await run("split-pdf", files, { pageCount: 5, mode: "every", every: 2 });
    expect(outputs.map((o) => o.name)).toEqual([
      "report-pages-1-2.pdf",
      "report-pages-3-4.pdf",
      "report-page-5.pdf",
    ]);
  });

  it("explains why it can't run yet", async () => {
    const files = [accepted(pdfFile(await numberedPdf(5)))];
    expect(blocker("split-pdf", files, {})).toBe("Reading the PDF…");
    expect(blocker("split-pdf", files, { pageCount: 5, ranges: "1-9" })).toMatch("Page 9 doesn't exist");
    expect(blocker("split-pdf", files, { pageCount: 5, ranges: "1-5" })).toMatch("keeps every page together");
    expect(blocker("split-pdf", files, { pageCount: 5, mode: "every", every: 5 })).toMatch("keeps every page");
  });
});

describe("rotate-pdf", () => {
  it("turns only the chosen pages", async () => {
    const files = [accepted(pdfFile(await numberedPdf(3), "scan.pdf"))];
    expect(blocker("rotate-pdf", files, { pageCount: 3, turns: { 0: 0 } })).toBe("Turn at least one page.");
    const [output] = await run("rotate-pdf", files, { pageCount: 3, turns: { 1: 90, 2: 270 } });
    expect(output.name).toBe("scan-rotated.pdf");
    expect(await pageRotations(await blobBytes(output.data))).toEqual([0, 90, 270]);
  });
});

describe("organize-pdf", () => {
  it("writes pages in the new order without deleted ones", async () => {
    const files = [accepted(pdfFile(await numberedPdf(4), "deck.pdf"))];
    expect(blocker("organize-pdf", files, { pageCount: 4 })).toMatch("Move, turn, or delete");
    expect(blocker("organize-pdf", files, { pageCount: 4, pages: [] })).toBe("Keep at least one page.");
    const pages = [
      { key: "p3", index: 3, rotate: 0 },
      { key: "p0", index: 0, rotate: 180 },
    ];
    const [output] = await run("organize-pdf", files, { pageCount: 4, pages });
    const bytes = await blobBytes(output.data);
    expect(output.name).toBe("deck-organized.pdf");
    expect(await pageNumbers(bytes)).toEqual([4, 1]);
    expect(await pageRotations(bytes)).toEqual([0, 180]);
  });
});

describe("extract-pages", () => {
  it("extracts the selection into one PDF or one per page", async () => {
    const files = [accepted(pdfFile(await numberedPdf(5), "book.pdf"))];
    expect(blocker("extract-pages", files, { pageCount: 5 })).toBe("Select the pages to extract.");

    const [single] = await run("extract-pages", files, { pageCount: 5, selected: [1, 3] });
    expect(single.name).toBe("book-extracted.pdf");
    expect(await pageNumbers(await blobBytes(single.data))).toEqual([2, 4]);

    const separate = await run("extract-pages", files, { pageCount: 5, selected: [1, 3], output: "separate" });
    expect(separate.map((o) => o.name)).toEqual(["book-page-2.pdf", "book-page-4.pdf"]);
  });
});

describe("image-to-pdf", () => {
  it("puts upright JPEGs and PNGs on pages in order", async () => {
    const files = [
      accepted(new File([PNG_4X2 as Uint8Array<ArrayBuffer>], "one.png"), "png"),
      accepted(new File([JPEG_4X2 as Uint8Array<ArrayBuffer>], "two.jpg"), "jpeg"),
    ];
    const implementation = tool("image-to-pdf");
    const ctx = context();
    const options = { ...(implementation.initialOptions(files) as object), pageSize: "fit", margin: "none" };
    const [output] = await implementation.process(files, options, ctx);
    expect(output.name).toBe("images.pdf");
    expect(ctx.onProgress).toHaveBeenCalledWith({ done: 1, total: 2, unit: "images" });
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(await blobBytes(output.data));
    expect(doc.getPages().map((page) => page.getSize())).toEqual([
      { width: 3, height: 1.5 },
      { width: 3, height: 1.5 },
    ]);
  });
});
