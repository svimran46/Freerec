import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { dedupeNames, zipFiles } from "./download";
import { formatBytes } from "./format";

describe("dedupeNames", () => {
  it("suffixes repeated names before the extension", () => {
    expect(dedupeNames(["a.pdf", "a.pdf", "b.pdf", "a.pdf", "README", "README"])).toEqual([
      "a.pdf",
      "a (2).pdf",
      "b.pdf",
      "a (3).pdf",
      "README",
      "README (2)",
    ]);
  });
});

describe("zipFiles", () => {
  it("bundles outputs with unique names and intact contents", async () => {
    const blob = await zipFiles([
      { name: "page.png", data: new Blob(["one"]) },
      { name: "page.png", data: new Blob(["two"]) },
    ]);
    expect(blob.type).toBe("application/zip");
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const decode = (b: Uint8Array) => new TextDecoder().decode(b);
    expect(Object.keys(entries)).toEqual(["page.png", "page (2).png"]);
    expect(decode(entries["page.png"])).toBe("one");
    expect(decode(entries["page (2).png"])).toBe("two");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1536, "1.5 KB"],
    [100 * 1024 * 1024, "100 MB"],
    [-1, "—"],
  ])("%d → %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});
