import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { download, forbidUploads, imageInfo } from "./helpers";

const fixture = async (file: string, name = file) => ({
  name,
  mimeType: "application/octet-stream",
  buffer: await readFile(join(__dirname, "fixtures", file)),
});

// Image codecs are WebAssembly; give the first encode time to load them.
test.setTimeout(90_000);

test("compress a photo with a live before/after preview", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/compress-image");
  const original = await fixture("photo.jpg");
  await page.getByTestId("file-input").setInputFiles([original]);

  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByText(/% smaller/)).toBeVisible({ timeout: 30_000 });
  await expect(preview.getByRole("img", { name: "After" })).toBeVisible();
  await expect(preview.getByRole("slider", { name: "Compare before and after" })).toBeVisible();

  await page.getByRole("button", { name: "Compress image" }).click();
  await expect(page.getByRole("region", { name: "Results" }).getByText(/800 × 600 · .*% smaller/)).toBeVisible();
  const output = await download(page, "photo.jpg");
  expect(imageInfo(output)).toEqual({ type: "jpeg", width: 800, height: 600 });
  expect(output.length).toBeLessThan(original.buffer.length);
  noUploads();
});

test("compress to WebP at a chosen quality", async ({ page }) => {
  await page.goto("/tools/compress-image");
  await page.getByTestId("file-input").setInputFiles([await fixture("photo.jpg")]);
  await page.getByText("WebP", { exact: true }).click();
  await page.getByRole("slider", { name: /Quality/ }).fill("40");
  await expect(page.getByText("Quality: 40")).toBeVisible();
  await page.getByRole("button", { name: "Compress image" }).click();
  expect(imageInfo(await download(page, "photo.webp"))).toMatchObject({ type: "webp", width: 800, height: 600 });
});

test("resize several images to a width, keeping proportions and transparency", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/resize-image");
  await page.getByTestId("file-input").setInputFiles([await fixture("photo.jpg"), await fixture("logo.png")]);
  await page.getByRole("spinbutton", { name: "Width (px)" }).fill("400");
  await expect(page.getByText("photo.jpg: 800 × 600 → 400 × 300")).toBeVisible();
  await page.getByRole("button", { name: "Resize image" }).click();

  expect(imageInfo(await download(page, "photo-400x300.jpg"))).toEqual({ type: "jpeg", width: 400, height: 300 });
  expect(imageInfo(await download(page, "logo-400x300.png"))).toEqual({
    type: "png",
    width: 400,
    height: 300,
    alpha: true,
  });
  noUploads();
});

test("resize for social media by cropping to fill", async ({ page }) => {
  await page.goto("/tools/resize-image");
  await page.getByTestId("file-input").setInputFiles([await fixture("photo.jpg")]);
  await page.getByText("For social media").click();
  await page.getByRole("combobox", { name: "Size" }).selectOption("story");
  await expect(page.getByText("photo.jpg: 800 × 600 → 1080 × 1920")).toBeVisible();
  await page.getByRole("button", { name: "Resize image" }).click();
  expect(imageInfo(await download(page, "photo-1080x1920.jpg"))).toEqual({ type: "jpeg", width: 1080, height: 1920 });
});

test("convert HEIC, TIFF, AVIF, and WebP images", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/convert-image");
  await page.getByTestId("file-input").setInputFiles([
    await fixture("photo.heic", "iphone.heic"),
    await fixture("photo.tiff", "scan.tiff"),
    await fixture("photo.avif", "web.avif"),
    await fixture("logo.webp"),
  ]);
  await page.getByText("PNG", { exact: true }).click();
  await page.getByRole("button", { name: "Convert image" }).click();

  for (const name of ["iphone", "scan", "web"]) {
    expect(imageInfo(await download(page, `${name}.png`))).toMatchObject({ type: "png", width: 64, height: 48 });
  }
  expect(imageInfo(await download(page, "logo.png"))).toEqual({ type: "png", width: 40, height: 30, alpha: true });
  noUploads();
});

test("upscale an image 4×", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/tools/upscale-image");
  await page.getByTestId("file-input").setInputFiles([await fixture("photo.jpg")]);
  await expect(page.getByText("800 × 600 → 1600 × 1200")).toBeVisible();
  await page.getByText("4×", { exact: true }).click();
  await expect(page.getByText("800 × 600 → 3200 × 2400")).toBeVisible();
  await page.getByRole("button", { name: "Upscale image" }).click();
  expect(imageInfo(await download(page, "photo-4x.jpg"))).toEqual({ type: "jpeg", width: 3200, height: 2400 });
  noUploads();
});

test("put an iPhone HEIC photo into a PDF", async ({ page }) => {
  await page.goto("/tools/image-to-pdf");
  await page.getByTestId("file-input").setInputFiles([await fixture("photo.heic", "IMG_0001.heic")]);
  await page.getByText("Same as image").click();
  await page.getByText("None", { exact: true }).click();
  await page.getByRole("button", { name: "Images to PDF" }).click();

  const doc = await PDFDocument.load(await download(page, "IMG_0001.pdf"));
  // 64 × 48 pixels at 96 per inch is 48 × 36 points.
  expect(doc.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([[48, 36]]);
});
