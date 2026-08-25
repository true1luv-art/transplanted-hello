/**
 * NFT metadata parsing.
 *
 * Supported shapes (a creator may drop one big file or a whole directory of
 * per-token files):
 *   [ {...}, {...} ]                      array of NFT metadata
 *   { "nfts": [...] } / { "items": [...] } / { "tokens": [...] } / { "collection": {...}, "nfts": [...] }
 *   { ...single NFT... }                  one file per token (1.json, 2.json …)
 *
 * The original document is preserved verbatim on `raw` — we never rewrite the
 * creator's metadata.
 */
import type { ImportIssue, ParsedMetadataRecord, RawAttribute } from "./types";

export interface ParseResult {
  records: ParsedMetadataRecord[];
  issues: ImportIssue[];
}

const ARRAY_KEYS = ["nfts", "items", "tokens", "assets", "metadata", "data"];

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

function normalizeAttributes(input: unknown): { attributes: RawAttribute[]; invalid: boolean } {
  if (input === undefined || input === null) return { attributes: [], invalid: false };

  // Array form: [{ trait_type, value }]
  if (Array.isArray(input)) {
    const attributes: RawAttribute[] = [];
    let invalid = false;
    for (const entry of input) {
      if (!entry || typeof entry !== "object") {
        invalid = true;
        continue;
      }
      const record = entry as Record<string, unknown>;
      const traitType = asString(
        record["trait_type"] ?? record["traitType"] ?? record["trait"] ?? record["key"],
      );
      const value = record["value"] ?? record["val"];
      if (
        !traitType ||
        value === undefined ||
        value === null ||
        (typeof value !== "string" && typeof value !== "number")
      ) {
        invalid = true;
        continue;
      }
      attributes.push({ ...record, trait_type: traitType, value });
    }
    return { attributes, invalid };
  }

  // Object form: { Background: "Blue", Base: "Otter" }
  if (typeof input === "object") {
    const attributes: RawAttribute[] = [];
    for (const [traitType, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === "string" || typeof value === "number")
        attributes.push({ trait_type: traitType, value });
    }
    return { attributes, invalid: attributes.length === 0 };
  }

  return { attributes: [], invalid: true };
}

function toRecord(
  raw: Record<string, unknown>,
  sourceFile: string,
  sourceIndex: number,
): ParsedMetadataRecord {
  const { attributes } = normalizeAttributes(raw["attributes"] ?? raw["traits"]);
  const properties = raw["properties"];
  const files = raw["files"] ?? (properties as Record<string, unknown> | undefined)?.["files"];
  return {
    sourceFile,
    sourceIndex,
    name: asString(raw["name"]).trim(),
    description: asString(raw["description"]),
    image: asString(raw["image"] ?? raw["image_url"] ?? raw["imageUrl"]).trim(),
    externalUrl: asString(raw["external_url"] ?? raw["externalUrl"]) || undefined,
    attributes,
    properties:
      properties && typeof properties === "object"
        ? (properties as Record<string, unknown>)
        : undefined,
    files: Array.isArray(files) ? files : undefined,
    raw,
  };
}

/** Extracts NFT metadata documents out of one JSON text blob. */
export function parseMetadataFile(filename: string, text: string): ParseResult {
  const issues: ImportIssue[] = [];
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    return {
      records: [],
      issues: [
        {
          code: "JSON_SYNTAX",
          severity: "error",
          subject: filename,
          message: `Invalid JSON: ${error instanceof Error ? error.message : "parse error"}`,
        },
      ],
    };
  }

  let list: unknown[] | null = null;
  if (Array.isArray(doc)) {
    list = doc;
  } else if (doc && typeof doc === "object") {
    const record = doc as Record<string, unknown>;
    for (const key of ARRAY_KEYS) {
      if (Array.isArray(record[key])) {
        list = record[key] as unknown[];
        break;
      }
    }
    // A single NFT document (one file per token).
    if (!list && (record["name"] !== undefined || record["image"] !== undefined)) list = [record];
  }

  if (!list) {
    return {
      records: [],
      issues: [
        {
          code: "METADATA_STRUCTURE",
          severity: "error",
          subject: filename,
          message:
            "Unrecognised metadata structure — expected an array of NFT objects or { nfts: [...] }",
        },
      ],
    };
  }

  const records: ParsedMetadataRecord[] = [];
  list.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push({
        code: "METADATA_STRUCTURE",
        severity: "error",
        subject: `${filename}[${index}]`,
        message: "Metadata entry is not an object",
      });
      return;
    }
    const record = toRecord(entry as Record<string, unknown>, filename, index);
    const { invalid } = normalizeAttributes((entry as Record<string, unknown>)["attributes"]);
    if (invalid) {
      issues.push({
        code: "INVALID_ATTRIBUTES",
        severity: "warning",
        subject: record.name || `${filename}[${index}]`,
        message: "Some attributes were skipped — each needs a trait_type and a string/number value",
      });
    }
    records.push(record);
  });

  return { records, issues };
}

/** Parses many metadata files (directory import) into one record set. */
export async function parseMetadataFiles(files: File[]): Promise<ParseResult> {
  const records: ParsedMetadataRecord[] = [];
  const issues: ImportIssue[] = [];
  // Natural sort so 2.json comes before 10.json when order is the fallback.
  const sorted = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  for (const file of sorted) {
    const result = parseMetadataFile(file.name, await file.text());
    records.push(...result.records);
    issues.push(...result.issues);
  }
  return { records, issues };
}
