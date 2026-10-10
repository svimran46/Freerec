import { describe, expect, it } from "vitest";
import { validateFiles } from "./validate-files";

const pdf = (name: string, extra = 0) => new File(["%PDF-1.7\n" + "x".repeat(extra)], name);
const tool = { accepts: ["pdf"] as const, maxFiles: 2, maxFileBytes: 100 };

describe("validateFiles", () => {
  it("accepts matching files and records their kind", async () => {
    const { accepted, rejected } = await validateFiles(tool, [pdf("a.pdf")]);
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ kind: "pdf", file: { name: "a.pdf" } });
  });

  it("rejects wrong types, empty files, and oversize files with reasons", async () => {
    const { accepted, rejected } = await validateFiles(tool, [
      new File(["hello"], "notes.pdf"),
      new File([], "empty.pdf"),
      pdf("big.pdf", 200),
    ]);
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "Not a supported file. This tool accepts PDF.",
      "The file is empty.",
      "Larger than the 100 B limit.",
    ]);
  });

  it("enforces the file cap across drops", async () => {
    const { accepted, rejected } = await validateFiles(tool, [pdf("a.pdf"), pdf("b.pdf")], 1);
    expect(accepted.map((a) => a.file.name)).toEqual(["a.pdf"]);
    expect(rejected[0]).toMatchObject({ file: { name: "b.pdf" }, reason: "Only 2 file(s) at a time." });
  });

  it("gives every accepted file a unique id", async () => {
    const { accepted } = await validateFiles(tool, [pdf("a.pdf"), pdf("a.pdf")]);
    expect(new Set(accepted.map((a) => a.id)).size).toBe(2);
  });
});
