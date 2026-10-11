/** Returns a copy of `items` with the item at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return result;
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
