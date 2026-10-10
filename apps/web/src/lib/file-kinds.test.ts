import { describe, expect, it } from "vitest";
import { acceptAttribute, detectKind, extensionOf, kindFromExtension } from "./file-kinds";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(
    parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)),
  );

const pad = (n: number) => new Array<number>(n).fill(0x20);

describe("detectKind", () => {
  it.each([
    ["pdf", bytes("%PDF-1.7\n"), "doc.pdf"],
    ["pdf", bytes([0xef, 0xbb, 0xbf], "%PDF-1.4"), "with-bom.pdf"],
    ["jpeg", bytes([0xff, 0xd8, 0xff, 0xe0]), "photo.jpg"],
    ["png", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "a.png"],
    ["gif", bytes("GIF89a"), "a.gif"],
    ["webp", bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "), "a.webp"],
    ["bmp", bytes("BM", [0, 0, 0, 0]), "a.bmp"],
    ["tiff", bytes([0x49, 0x49, 0x2a, 0x00]), "a.tif"],
    ["avif", bytes([0, 0, 0, 0x1c], "ftypavif"), "a.avif"],
    ["heic", bytes([0, 0, 0, 0x18], "ftypheic"), "IMG_0001.HEIC"],
    ["rtf", bytes("{\\rtf1\\ansi"), "a.rtf"],
    ["html", bytes("<!doctype html>"), "page.html"],
    ["txt", bytes("hello"), "notes.txt"],
  ] as const)("detects %s", (kind, head, name) => {
    expect(detectKind(head, name)).toBe(kind);
  });

  it("detects EPUB from its mimetype entry regardless of extension", () => {
    const head = bytes([0x50, 0x4b, 0x03, 0x04], pad(26), "mimetypeapplication/epub+zip");
    expect(detectKind(head, "book.zip")).toBe("epub");
  });

  it("uses the extension to tell ZIP-based Office formats apart", () => {
    const zip = bytes([0x50, 0x4b, 0x03, 0x04], pad(40));
    expect(detectKind(zip, "report.docx")).toBe("docx");
    expect(detectKind(zip, "sheet.xlsx")).toBe("xlsx");
    expect(detectKind(zip, "archive.zip")).toBeNull();
  });

  it("uses the extension to tell legacy OLE Office formats apart", () => {
    const ole = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(detectKind(ole, "old.doc")).toBe("doc");
    expect(detectKind(ole, "old.ppt")).toBe("ppt");
    expect(detectKind(ole, "old.msi")).toBeNull();
  });

  it("detects MOBI and AZW3 by the BOOKMOBI marker", () => {
    const head = bytes(pad(60), "BOOKMOBI");
    expect(detectKind(head, "book.mobi")).toBe("mobi");
    expect(detectKind(head, "book.azw3")).toBe("azw3");
  });

  it("does not trust the extension when the content disagrees", () => {
    expect(detectKind(bytes([0xff, 0xd8, 0xff]), "fake.pdf")).toBe("jpeg");
    expect(detectKind(bytes([0x00, 0x01, 0x02]), "fake.pdf")).toBeNull();
    expect(detectKind(bytes("plain text"), "fake.pdf")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectKind(new Uint8Array(), "empty.txt")).toBeNull();
  });
});

describe("extension helpers", () => {
  it("lowercases and handles missing extensions", () => {
    expect(extensionOf("A.PDF")).toBe(".pdf");
    expect(extensionOf("README")).toBe("");
    expect(kindFromExtension("photo.JPEG")).toBe("jpeg");
    expect(kindFromExtension("unknown.xyz")).toBeNull();
  });

  it("builds an accept attribute with MIME types and extensions", () => {
    expect(acceptAttribute(["pdf", "png"])).toBe("application/pdf,.pdf,image/png,.png");
  });
});
