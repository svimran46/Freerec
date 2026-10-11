// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { JPEG_4X2, numberedPdf, pageNumbers, pageRotations, PNG_4X2 } from "@/test/fixtures";
import { imagesToPdf, loadPdf, mergePdfs, placeImage, rebuildPdf, splitPdf } from "./edit";
import { PdfError } from "./types";

const named = (bytes: Uint8Array, name = "doc.pdf") => ({ name, bytes });

describe("PDF edits", () => {
  it("merges documents in the order given", async () => {
    const merged = await mergePdfs([named(await numberedPdf(2)), named(await numberedPdf(3))]);
    expect(await pageNumbers(merged)).toEqual([1, 2, 1, 2, 3]);
    expect((await PDFDocument.load(merged, { updateMetadata: false })).getProducer()).toBe("Freerec");
  });

  it("rebuilds a document with pages reordered, dropped, and turned", async () => {
    const source = await numberedPdf(4);
    const output = await rebuildPdf(named(source), [
      { index: 3 },
      { index: 0, rotate: 90 },
      { index: 2, rotate: -90 },
    ]);
    expect(await pageNumbers(output)).toEqual([4, 1, 3]);
    expect(await pageRotations(output)).toEqual([0, 90, 270]);
  });

  it("adds turns to a page's existing rotation", async () => {
    const doc = await PDFDocument.load(await numberedPdf(1));
    const { degrees } = await import("pdf-lib");
    doc.getPage(0).setRotation(degrees(270));
    const output = await rebuildPdf(named(await doc.save()), [{ index: 0, rotate: 180 }]);
    expect(await pageRotations(output)).toEqual([90]);
  });

  it("rejects page lists that are empty or out of range", async () => {
    const source = await numberedPdf(2);
    await expect(rebuildPdf(named(source), [])).rejects.toThrow("Keep at least one page.");
    await expect(rebuildPdf(named(source), [{ index: 2 }])).rejects.toThrow("Page 3 doesn't exist");
  });

  it("splits a document into one file per range", async () => {
    const parts = await splitPdf(named(await numberedPdf(5)), [
      { start: 0, end: 1 },
      { start: 4, end: 4 },
    ]);
    expect(await Promise.all(parts.map(pageNumbers))).toEqual([[1, 2], [5]]);
    await expect(splitPdf(named(await numberedPdf(2)), [{ start: 1, end: 2 }])).rejects.toThrow(PdfError);
  });

  it("explains unreadable and encrypted files", async () => {
    await expect(loadPdf(named(new TextEncoder().encode("%PDF-1.7 nonsense"), "bad.pdf"))).rejects.toThrow(
      "bad.pdf couldn't be read",
    );
    const encrypted = new TextEncoder().encode(
      [
        "%PDF-1.7",
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj",
        "3 0 obj << /Filter /Standard /V 1 /R 2 /O (x) /U (x) /P -4 >> endobj",
        "trailer << /Root 1 0 R /Encrypt 3 0 R >>",
        "%%EOF",
      ].join("\n"),
    );
    await expect(loadPdf(named(encrypted, "locked.pdf"))).rejects.toThrow(
      "locked.pdf is password-protected",
    );
  });

  it("refuses documents over the page limit", async () => {
    await expect(loadPdf(named(await numberedPdf(501), "huge.pdf"))).rejects.toThrow(
      "huge.pdf has 501 pages. The limit is 500.",
    );
  });
});

describe("images to PDF", () => {
  it("puts each image on its own page", async () => {
    const output = await imagesToPdf(
      [
        { name: "a.png", type: "png", bytes: PNG_4X2 },
        { name: "b.jpg", type: "jpeg", bytes: JPEG_4X2 },
      ],
      { pageSize: "a4", orientation: "auto", margin: 0 },
    );
    const doc = await PDFDocument.load(output);
    // Wide images get landscape A4 pages.
    expect(doc.getPages().map((page) => page.getSize())).toEqual([
      { width: 841.89, height: 595.28 },
      { width: 841.89, height: 595.28 },
    ]);
  });

  it("reports images it can't embed", async () => {
    await expect(
      imagesToPdf([{ name: "x.png", type: "png", bytes: new Uint8Array([1, 2, 3]) }], {
        pageSize: "fit",
        orientation: "auto",
        margin: 0,
      }),
    ).rejects.toThrow("x.png couldn't be read");
  });

  it("sizes pages to the image or centers the image on a fixed page", () => {
    expect(placeImage(400, 200, { pageSize: "fit", orientation: "auto", margin: 10 })).toEqual({
      page: [320, 170],
      box: { x: 10, y: 10, width: 300, height: 150 },
    });
    const { page, box } = placeImage(1000, 1000, { pageSize: "letter", orientation: "portrait", margin: 36 });
    expect(page).toEqual([612, 792]);
    expect(box.width).toBeCloseTo(540);
    expect(box.x).toBeCloseTo(36);
    expect(box.y).toBeCloseTo((792 - 540) / 2);
  });
});
