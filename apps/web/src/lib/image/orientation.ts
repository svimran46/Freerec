/**
 * Reads the EXIF orientation (1–8) of a JPEG; 1 means upright or unknown.
 * Phone cameras save pixels sideways and set this tag, which PDFs ignore.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(0) !== 0xffd8) return 1;
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) return 1;
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      // Start of scan or end of image: no metadata follows.
      if (marker === 0xda || marker === 0xd9) return 1;
      const length = view.getUint16(offset + 2);
      const isExif =
        marker === 0xe1 &&
        String.fromCharCode(...bytes.subarray(offset + 4, offset + 10)) === "Exif\0\0";
      if (isExif) return readTiffOrientation(view, offset + 10, offset + 2 + length);
      offset += 2 + length;
    }
  } catch {
    // A truncated or malformed header reads past the end; treat it as upright.
  }
  return 1;
}

function readTiffOrientation(view: DataView, tiff: number, end: number): number {
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return 1;
  const little = order === 0x4949;
  const ifd = tiff + view.getUint32(tiff + 4, little);
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return 1;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}
