import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { forbidUploads } from "./helpers";

test("drop a file on the homepage and open a tool with it", async ({ page }) => {
  const noUploads = forbidUploads(page);
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles([join(__dirname, "fixtures", "photo.jpg")]);

  await expect(page.getByRole("heading", { name: "Here is what you can do" })).toBeVisible();
  await page.getByRole("button", { name: /^Compress image/ }).click();

  await expect(page).toHaveURL(/\/tools\/compress-image$/);
  await expect(page.getByRole("list", { name: "Selected files" }).getByText("photo.jpg")).toBeVisible();
  noUploads();
});

test("explain a file no tool takes", async ({ page }) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([{ name: "data.bin", mimeType: "application/octet-stream", buffer: Buffer.from([0, 1, 2, 0]) }]);
  await expect(page.getByRole("heading", { name: "No tool takes this file yet" })).toBeVisible();
});

test("filter the tool directory", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("Find a tool");
  await search.fill("heic");
  const directory = page.locator("#tools");
  await expect(directory.getByRole("link", { name: /Convert image/ })).toBeVisible();
  await expect(directory.getByRole("link", { name: /Merge PDF/ })).toHaveCount(0);
  await search.fill("nothing like this");
  await expect(directory.getByText(/No tool matches/)).toBeVisible();
});
