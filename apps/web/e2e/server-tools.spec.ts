import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { download } from "./helpers";

// These need the whole stack (web built with NEXT_PUBLIC_SERVER_TOOLS=true, API,
// worker, storage), as in CI's "stack" job; see playwright.config.ts.
const FIXTURES = join(__dirname, "../../../services/backend/tests/fixtures");

const fixture = async (file: string) => ({
  name: file,
  mimeType: "application/octet-stream",
  buffer: await readFile(join(FIXTURES, file)),
});

// LibreOffice and Calibre take a few seconds to start in the worker.
test.setTimeout(120_000);

/** Records job deletions, which must follow every finished job. */
function watchDeletes(page: Page) {
  const deleted: number[] = [];
  page.on("response", (response) => {
    if (response.request().method() === "DELETE" && new URL(response.url()).pathname.startsWith("/api/jobs/")) {
      deleted.push(response.status());
    }
  });
  return deleted;
}

async function run(page: Page, slug: string, file: string, button: string) {
  await page.goto(`/tools/${slug}`);
  await page.getByTestId("file-input").setInputFiles([await fixture(file)]);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 100_000 });
  await expect(page.getByText(/deleted from our servers$/)).toBeVisible();
}

const isZip = (bytes: Buffer) => bytes.subarray(0, 2).toString() === "PK";

test("compress a PDF and delete it from the server", async ({ page }) => {
  const deleted = watchDeletes(page);
  await page.goto("/tools/compress-pdf");
  await page.getByTestId("file-input").setInputFiles([await fixture("report.pdf")]);
  await page.getByText("Strong · smallest file").click();
  await page.getByRole("button", { name: "Compress PDF" }).click();
  await expect(page.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 100_000 });

  const output = await download(page, "report-compressed.pdf");
  expect((await PDFDocument.load(output)).getPageCount()).toBe(1);
  expect(deleted).toEqual([204]);
});

test("convert a Word document to PDF", async ({ page }) => {
  await run(page, "office-to-pdf", "report.docx", "Office to PDF");
  const doc = await PDFDocument.load(await download(page, "report.pdf"));
  expect(doc.getPageCount()).toBeGreaterThan(0);
});

for (const [slug, button, extension] of [
  ["pdf-to-word", "PDF to Word", "docx"],
  ["pdf-to-excel", "PDF to Excel", "xlsx"],
  ["pdf-to-powerpoint", "PDF to PowerPoint", "pptx"],
] as const) {
  test(`convert a PDF to ${extension}`, async ({ page }) => {
    await run(page, slug, "report.pdf", button);
    expect(isZip(await download(page, `report.${extension}`))).toBe(true);
  });
}

test("print an HTML file to a US Letter PDF", async ({ page }) => {
  await page.goto("/tools/html-to-pdf");
  await page.getByTestId("file-input").setInputFiles([await fixture("page.html")]);
  await page.getByText("US Letter").click();
  await page.getByRole("button", { name: "HTML to PDF" }).click();
  await expect(page.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 100_000 });
  const doc = await PDFDocument.load(await download(page, "page.pdf"));
  expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
});

test("convert an EPUB to MOBI", async ({ page }) => {
  await page.goto("/tools/ebook-converter");
  await page.getByTestId("file-input").setInputFiles([await fixture("book.epub")]);
  await page.getByText("MOBI", { exact: true }).click();
  await page.getByRole("button", { name: "Ebook converter" }).click();
  await expect(page.getByRole("region", { name: "Results" })).toBeVisible({ timeout: 100_000 });
  const book = await download(page, "book.mobi");
  expect(book.subarray(60, 68).toString()).toBe("BOOKMOBI");
});

test("explain a damaged file and clean up after it", async ({ page }) => {
  const deleted = watchDeletes(page);
  await page.goto("/tools/pdf-to-excel");
  await page.getByTestId("file-input").setInputFiles([
    { name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nnothing here") },
  ]);
  await page.getByRole("button", { name: "PDF to Excel" }).click();
  await expect(page.getByText("broken.pdf couldn't be read. It may be damaged.")).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => deleted).toEqual([204]);
});
