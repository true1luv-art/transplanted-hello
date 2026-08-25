/**
 * Import validation.
 *
 * Every rule is checked before a collection may be submitted:
 * JSON syntax (see parse.ts), metadata structure, names, token ids, image
 * references, image existence, duplicates, orphans, attributes, image formats
 * and supply coverage.
 */
import { config } from "@/lib/config/config";
import type { ImportIssue, ParsedMetadataRecord } from "./types";
import { imageBasename } from "./image-match";

const MAX_LISTED = 5;

/** Collapses repeated issues of the same code into one row with a count. */
export function collapseIssues(issues: ImportIssue[]): ImportIssue[] {
  const groups = new Map<string, ImportIssue[]>();
  for (const issue of issues) {
    const bucket = groups.get(issue.code) ?? [];
    bucket.push(issue);
    groups.set(issue.code, bucket);
  }
  const out: ImportIssue[] = [];
  for (const bucket of groups.values()) {
    out.push(...bucket.slice(0, MAX_LISTED));
    if (bucket.length > MAX_LISTED) {
      const first = bucket[0]!;
      out.push({
        code: first.code,
        severity: first.severity,
        message: `…and ${bucket.length - MAX_LISTED} more ${first.code.toLowerCase().replace(/_/g, " ")} issues`,
        count: bucket.length - MAX_LISTED,
      });
    }
  }
  return out;
}

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
};

export const isSupportedImageName = (filename: string) =>
  config.storage.supportedExtensions.includes(extensionOf(filename));

export interface ValidateInput {
  records: ParsedMetadataRecord[];
  tokenIds: (number | null)[];
  matched: Map<number, string>;
  missing: number[];
  orphans: string[];
  imageFilenames: string[];
  maxSupply: number;
}

export function validateImport(input: ValidateInput): ImportIssue[] {
  const { records, tokenIds, missing, orphans, imageFilenames, maxSupply } = input;
  const issues: ImportIssue[] = [];

  if (records.length === 0) {
    issues.push({
      code: "NO_METADATA",
      severity: "error",
      message: "Upload the NFT metadata JSON to continue",
    });
  }
  if (imageFilenames.length === 0) {
    issues.push({
      code: "NO_IMAGES",
      severity: "error",
      message: "Upload the NFT images to continue",
    });
  }

  // Names, image references, token ids
  records.forEach((record, index) => {
    if (!record.name) {
      issues.push({
        code: "MISSING_NAME",
        severity: "error",
        subject: `${record.sourceFile}[${record.sourceIndex}]`,
        message: "Metadata record has no name",
      });
    }
    if (!record.image) {
      issues.push({
        code: "MISSING_IMAGE_REF",
        severity: "error",
        subject: record.name || `${record.sourceFile}[${record.sourceIndex}]`,
        message: "Metadata record has no image reference",
      });
    } else if (!isSupportedImageName(imageBasename(record.image))) {
      issues.push({
        code: "UNSUPPORTED_IMAGE",
        severity: "error",
        subject: record.name,
        message: `Image reference "${imageBasename(record.image)}" is not a supported format (${config.storage.supportedExtensions.join(", ")})`,
      });
    }
    if (tokenIds[index] === null || tokenIds[index] === undefined) {
      issues.push({
        code: "TOKEN_ID_UNRESOLVED",
        severity: "error",
        subject: record.name || `${record.sourceFile}[${record.sourceIndex}]`,
        message: "No token number found in properties.tokenId, edition, name or image filename",
      });
    }
    if (record.attributes.length === 0) {
      issues.push({
        code: "INVALID_ATTRIBUTES",
        severity: "warning",
        subject: record.name,
        message: "Record has no attributes — it will score as fully common",
      });
    }
  });

  // Duplicate token ids
  const seenIds = new Set<number>();
  tokenIds.forEach((tokenId, index) => {
    if (tokenId === null || tokenId === undefined) return;
    if (seenIds.has(tokenId)) {
      issues.push({
        code: "DUPLICATE_TOKEN_ID",
        severity: "error",
        subject: records[index]?.name,
        message: `Token #${tokenId} appears more than once`,
      });
    }
    seenIds.add(tokenId);
  });

  // Duplicate image references and duplicate metadata documents
  const seenRefs = new Set<string>();
  const seenDocs = new Set<string>();
  records.forEach((record) => {
    const ref = imageBasename(record.image).toLowerCase();
    if (ref) {
      if (seenRefs.has(ref)) {
        issues.push({
          code: "DUPLICATE_IMAGE_REF",
          severity: "error",
          subject: record.name,
          message: `Image "${ref}" is referenced by more than one NFT`,
        });
      }
      seenRefs.add(ref);
    }
    const signature = `${record.name}|${ref}|${record.attributes
      .map((a) => `${a.trait_type}=${a.value}`)
      .sort()
      .join(",")}`;
    if (seenDocs.has(signature)) {
      issues.push({
        code: "DUPLICATE_METADATA",
        severity: "error",
        subject: record.name,
        message: "Duplicate metadata record (same name, image and attributes)",
      });
    }
    seenDocs.add(signature);
  });

  // Image existence / orphans / formats
  for (const index of missing) {
    issues.push({
      code: "MISSING_IMAGE",
      severity: "error",
      subject: records[index]?.name,
      message: `No uploaded image matches "${imageBasename(records[index]?.image ?? "")}"`,
    });
  }
  for (const orphan of orphans) {
    issues.push({
      code: "ORPHAN_IMAGE",
      severity: "warning",
      subject: orphan,
      message: "Image is not referenced by any metadata record",
    });
  }
  for (const filename of imageFilenames) {
    if (!isSupportedImageName(filename)) {
      issues.push({
        code: "UNSUPPORTED_IMAGE",
        severity: "error",
        subject: filename,
        message: `Unsupported image format (${config.storage.supportedExtensions.join(", ")})`,
      });
    }
  }

  // Supply coverage
  if (records.length > 0 && maxSupply > 0) {
    if (records.length !== maxSupply || input.matched.size !== maxSupply) {
      issues.push({
        code: "SUPPLY_MISMATCH",
        severity: "error",
        message: `Maximum supply ${maxSupply} · metadata ${records.length} · matched images ${input.matched.size}`,
      });
    }
  }

  return issues;
}
