/** Collects the distinct buffers under typed arrays so they can be transferred, not copied. */
export function transferables(value: unknown): ArrayBuffer[] {
  const found = new Set<ArrayBuffer>();
  const visit = (item: unknown) => {
    if (ArrayBuffer.isView(item)) {
      if (item.buffer instanceof ArrayBuffer) found.add(item.buffer);
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (item && typeof item === "object") {
      Object.values(item).forEach(visit);
    }
  };
  visit(value);
  return [...found];
}
