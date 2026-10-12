/**
 * Carries files picked on one page to the tool page the visitor opens next.
 * It lives in memory only, survives client-side navigation, and is emptied
 * the moment a tool takes it, so files are never stored or uploaded.
 */
let pending: { slug: string; files: File[] } | null = null;

export function handOff(slug: string, files: File[]): void {
  pending = { slug, files };
}

/** Takes the files waiting for this tool, if any. */
export function takeHandoff(slug: string): File[] | null {
  if (!pending || pending.slug !== slug) return null;
  const { files } = pending;
  pending = null;
  return files;
}
