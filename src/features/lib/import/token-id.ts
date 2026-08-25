/**
 * Token identifier detection.
 *
 * Never guesses silently: every record reports HOW its id was resolved, and
 * unresolved records surface as a validation issue the creator must fix
 * (or resolve with the "use import order" option).
 */
import type { ImportedNft, ParsedMetadataRecord } from "./types";

export type TokenIdSource = ImportedNft["tokenIdSource"];

export interface TokenIdResolution {
  tokenId: number | null;
  source: TokenIdSource;
}

const intFrom = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
};

/** `OTTER #1` -> 1 ; `Ember Sentinel 42` -> 42 */
function fromName(name: string): number | null {
  const hash = /#\s*(\d+)/.exec(name);
  if (hash) return Number(hash[1]);
  const trailing = /(\d+)\s*$/.exec(name.trim());
  return trailing ? Number(trailing[1]) : null;
}

/** `otter-#1.png` -> 1 ; `0042.png` -> 42 */
function fromImage(image: string): number | null {
  const base = image.split(/[\\/]/).pop() ?? image;
  const stem = base.replace(/\.[^.]+$/, "");
  const hash = /#\s*(\d+)/.exec(stem);
  if (hash) return Number(hash[1]);
  const digits = /(\d+)\s*$/.exec(stem);
  return digits ? Number(digits[1]) : null;
}

/**
 * Resolution order: explicit metadata fields, then the name, then the image
 * filename. Array position is NEVER used implicitly.
 */
export function resolveTokenId(record: ParsedMetadataRecord): TokenIdResolution {
  const props = record.properties ?? {};
  const explicit =
    intFrom(props["tokenId"]) ??
    intFrom(props["token_id"]) ??
    intFrom(props["tokenNumber"]) ??
    intFrom(record.raw["tokenId"]) ??
    intFrom(record.raw["token_id"]);
  if (explicit !== null) return { tokenId: explicit, source: "properties" };

  const edition = intFrom(record.raw["edition"]) ?? intFrom(props["edition"]);
  if (edition !== null) return { tokenId: edition, source: "edition" };

  const byName = fromName(record.name);
  if (byName !== null) return { tokenId: byName, source: "name" };

  const byImage = fromImage(record.image);
  if (byImage !== null) return { tokenId: byImage, source: "image" };

  return { tokenId: null, source: "order" };
}

export interface TokenIdOptions {
  /** Fall back to import order (1-based) when nothing else resolves. */
  useImportOrder?: boolean;
}

export function resolveTokenIds(
  records: ParsedMetadataRecord[],
  options: TokenIdOptions = {},
): { tokenId: number | null; source: TokenIdSource }[] {
  return records.map((record, index) => {
    const resolved = resolveTokenId(record);
    if (resolved.tokenId === null && options.useImportOrder)
      return { tokenId: index + 1, source: "order" as const };
    return resolved;
  });
}
