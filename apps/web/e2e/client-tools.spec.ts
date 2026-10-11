import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { JPEG_4X2, numberedPdf, pageNumbers, pageRotations, PNG_4X2, withExifOrientation } from "../src/test/fixtures";

/** A 1×1 GIF, which the browser has to redraw before it can go into a PDF. */
const GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const pdf = async (name: string, pages: number) => ({
  name,
  mimeType: "application/pdf",
  buffer: Buffer.from(await numberedPdf(pages)),
});

/** Fails the test if a page sends anything to our API: these tools must stay on the device. */
function forbidUploads(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) calls.push(request.url());
  });
  return () => expect(calls).toEqual([]);
}

async function download(page: Page, name: string): Promise<Buffer> {
  const results = page.getByRole("region", { name: "Results" });
  const row = results.getByRole("listitem").filter({ hasText: name });
  const [file] = await Promise.all([page.waitForEvent("download"), row.getByRole("button").click()]);
  expect(file.suggestedFilename()).toBe(name);
  return readFile((await file.path())!);
}

test("merge PDFs in a chosen order", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/merge-pdf");
  await page.getByTestId("file-input").setInputFiles([await pdf("a.pdf", 2), await pdf("b.pdf", 1)]);
  await page.getByRole("button", { name: "Move b.pdf up" }).click();
  await page.getByRole("button", { name: "Merge PDF" }).click();

  const merged = await download(page, "merged.pdf");
  expect(await pageNumbers(merged)).toEqual([1, 1, 2]);
  noUploads();
});

test("split a PDF by ranges", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/split-pdf");
  await page.getByTestId("file-input").setInputFiles([await pdf("report.pdf", 5)]);
  await expect(page.getByText("This PDF has 5 pages.")).toBeVisible();
  await page.getByRole("textbox", { name: "Page ranges" }).fill("1-2, 4");
  await expect(page.getByText("Makes 2 PDFs: 1-2, 4")).toBeVisible();
  await page.getByRole("button", { name: "Split PDF" }).click();

  expect(await pageNumbers(await download(page, "report-page-4.pdf"))).toEqual([4]);
  await expect(page.getByRole("button", { name: "Download all as ZIP" })).toBeVisible();
  noUploads();
});

test("rotate pages from their thumbnails", async ({ page }) => {
  await page.goto("/tools/rotate-pdf");
  await page.getByTestId("file-input").setInputFiles([await pdf("scan.pdf", 3)]);
  const grid = page.getByRole("list", { name: "Pages" });
  await expect(grid.locator("canvas")).toHaveCount(3);

  await page.getByRole("button", { name: "Turn page 2 right" }).click();
  await page.getByRole("button", { name: "Rotate PDF" }).click();
  expect(await pageRotations(await download(page, "scan-rotated.pdf"))).toEqual([0, 90, 0]);
});

test("reorder and delete pages", async ({ page }) => {
  await page.goto("/tools/organize-pdf");
  await page.getByTestId("file-input").setInputFiles([await pdf("deck.pdf", 4)]);
  await page.getByRole("button", { name: "Delete page 1" }).click();
  await page.getByRole("button", { name: "Move page 4 earlier" }).click();
  await expect(page.getByText("Keeping 3 of 4 pages.")).toBeVisible();

  // Drag the first remaining page (2) onto the last position.
  const cards = page.getByRole("list", { name: "Pages" }).getByRole("listitem");
  await cards.nth(0).dragTo(cards.nth(2));
  await page.getByRole("button", { name: "Reorder & delete pages" }).click();
  expect(await pageNumbers(await download(page, "deck-organized.pdf"))).toEqual([4, 3, 2]);
});

test("extract selected pages", async ({ page }) => {
  await page.goto("/tools/extract-pages");
  await page.getByTestId("file-input").setInputFiles([await pdf("book.pdf", 6)]);
  await page.getByRole("button", { name: "Page 2", exact: true }).click();
  await page.getByRole("textbox", { name: "Pages to extract" }).fill("2, 5-6");
  await expect(page.getByText("3 of 6 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 5", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Extract pages" }).click();
  expect(await pageNumbers(await download(page, "book-extracted.pdf"))).toEqual([2, 5, 6]);
});

test("convert PDF pages to images", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/pdf-to-image");
  await page.getByTestId("file-input").setInputFiles([await pdf("slides.pdf", 3)]);
  await page.getByText("PNG (sharper)").click();
  await page.getByRole("textbox", { name: "Pages" }).fill("2-3");
  await page.getByRole("button", { name: "PDF to image" }).click();

  const png = await download(page, "slides-page-3.png");
  expect([...png.subarray(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
  // Page 3 is 103 × 200 points; at 150 DPI that is 214 × 416 pixels.
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([214, 416]);
  await expect(page.getByText("slides-page-2.png")).toBeVisible();
  noUploads();
});

test("put images into a PDF, turning sideways photos upright", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/image-to-pdf");
  await page.getByTestId("file-input").setInputFiles([
    { name: "flat.png", mimeType: "image/png", buffer: Buffer.from(PNG_4X2) },
    { name: "sideways.jpg", mimeType: "image/jpeg", buffer: Buffer.from(withExifOrientation(JPEG_4X2, 6)) },
    { name: "dot.gif", mimeType: "image/gif", buffer: GIF_1X1 },
  ]);
  await page.getByText("Same as image").click();
  await page.getByText("None", { exact: true }).click();
  await page.getByRole("button", { name: "Images to PDF" }).click();

  const doc = await PDFDocument.load(await download(page, "images.pdf"));
  // The 4×2 photo tagged "rotate 90°" becomes a 2×4 page.
  expect(doc.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([
    [3, 1.5],
    [1.5, 3],
    [0.75, 0.75],
  ]);
  noUploads();
});

test("explain a file that isn't really a PDF", async ({ page }) => {
  await page.goto("/tools/rotate-pdf");
  await page.getByTestId("file-input").setInputFiles([
    { name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nnot a real pdf") },
  ]);
  await expect(page.getByText("fake.pdf couldn't be read")).toBeVisible();
});
