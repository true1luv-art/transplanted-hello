/**
 * Metadata <-> image matching.
 *
 * Matching is by FILENAME, never by array order, and EXACT filenames win.
 * NFTExport.io ships filenames such as `otter-#1.png`; `#` is a normal
 * filename character here — these are local ZIP entries, not URLs, so no URL
 * or fragment parsing may ever be applied to them.
 *
 *   "image": "images/otter-#1.png"  ->  otter-#1.png   ✓ exact
 *   "image": "ipfs://Qm.../7.PNG"   ->  7.png          ✓ case-insensitive
 */

/** Strips directories and ipfs://-style schemes. `#` and `?` are preserved. */
export function imageBasename(reference: string): string {
  const withoutScheme = reference.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return (withoutScheme.split(/[\\/]/).pop() ?? withoutScheme).trim();
}

/**
 * Loose fallback key: lowercased basename with whitespace collapsed.
 * Separators and `#` are PRESERVED so `otter-#1.png` and `otter-#2.png`
 * never collapse onto the same key.
 */
export function imageKey(reference: string): string {
  return imageBasename(reference).toLowerCase().replace(/\s+/g, " ");
}

export interface ImageIndex {
  /** exact basename -> filename */
  byExact: Map<string, string>;
  /** loose key -> filename (first wins) */
  byKey: Map<string, string>;
  /** filenames that produced the same key */
  duplicates: string[];
}

export function indexImages(filenames: string[]): ImageIndex {
  const byExact = new Map<string, string>();
  const byKey = new Map<string, string>();
  const duplicates: string[] = [];
  for (const filename of filenames) {
    const exact = imageBasename(filename);
    if (!byExact.has(exact)) byExact.set(exact, filename);
    const key = imageKey(filename);
    if (byKey.has(key)) duplicates.push(filename);
    else byKey.set(key, filename);
  }
  return { byExact, byKey, duplicates };
}

/** Exact basename first, then a case-insensitive fallback. */
export function resolveImage(index: ImageIndex, reference: string): string | undefined {
  if (!reference) return undefined;
  return index.byExact.get(imageBasename(reference)) ?? index.byKey.get(imageKey(reference));
}

export interface MatchResult {
  /** metadata index -> uploaded filename */
  matched: Map<number, string>;
  /** metadata indices with no uploaded image */
  missing: number[];
  /** uploaded filenames no metadata references */
  orphans: string[];
}

export function matchImages(imageRefs: string[], filenames: string[]): MatchResult {
  const index = indexImages(filenames);
  const used = new Set<string>();
  const matched = new Map<number, string>();
  const missing: number[] = [];

  imageRefs.forEach((reference, i) => {
    const filename = resolveImage(index, reference);
    if (filename) {
      matched.set(i, filename);
      used.add(filename);
    } else {
      missing.push(i);
    }
  });

  const orphans = filenames.filter((filename) => !used.has(filename));
  return { matched, missing, orphans };
}
