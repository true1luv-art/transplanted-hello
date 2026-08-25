/**
 * Asset validation. All limits live in `config.storage` — never inline in a
 * React component.
 */
import { config } from "@/lib/config/config";

export interface ValidatableFile {
  name: string;
  type: string;
  size: number;
}

export interface ValidationIssue {
  filename: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
};

/** Guesses the mime type from the extension when the browser gives none. */
export function mimeFromFilename(filename: string): string {
  switch (extensionOf(filename)) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function validateOne(file: ValidatableFile, maxSize: number): string | null {
  if (!file.name.trim()) return "Filename is required";
  if (/[\\/]/.test(file.name)) return "Filename must not contain path separators";
  const ext = extensionOf(file.name);
  if (!config.storage.supportedExtensions.includes(ext)) {
    return `Unsupported file extension "${ext || "none"}" (allowed: ${config.storage.supportedExtensions.join(", ")})`;
  }
  const mime = file.type || mimeFromFilename(file.name);
  if (!config.storage.supportedImageTypes.includes(mime)) {
    return `Unsupported file type "${mime}"`;
  }
  if (file.size <= 0) return "File is empty";
  if (file.size > maxSize) {
    return `File is larger than the ${(maxSize / (1024 * 1024)).toFixed(0)}MB limit`;
  }
  return null;
}

/** Validates the collection artwork. */
export function validateCollectionAsset(file: ValidatableFile): ValidationResult {
  const error = validateOne(file, config.storage.maxCollectionAssetSize);
  return { ok: !error, issues: error ? [{ filename: file.name, message: error }] : [] };
}

/** Validates a batch of NFT assets: types, sizes, duplicates and count. */
export function validateNftAssets(files: ValidatableFile[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (files.length === 0)
    issues.push({ filename: "-", message: "At least one NFT asset is required" });
  if (files.length > config.storage.maxNftAssets) {
    issues.push({
      filename: "-",
      message: `Too many files — the limit is ${config.storage.maxNftAssets}`,
    });
  }
  const seen = new Set<string>();
  for (const file of files) {
    const key = file.name.toLowerCase();
    if (seen.has(key)) issues.push({ filename: file.name, message: "Duplicate filename" });
    seen.add(key);
    const error = validateOne(file, config.storage.maxAssetFileSize);
    if (error) issues.push({ filename: file.name, message: error });
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Supply rule: the creator must know exactly what is minted, so the uploaded
 * asset count must cover `maxSupply` unless reusable assets are opted into.
 */
export function validateSupplyCoverage(
  assetCount: number,
  maxSupply: number,
  allowReusableAssets: boolean,
): ValidationResult {
  if (allowReusableAssets) {
    return assetCount > 0
      ? { ok: true, issues: [] }
      : {
          ok: false,
          issues: [{ filename: "-", message: "Reusable mode still needs at least one asset" }],
        };
  }
  if (assetCount < maxSupply) {
    return {
      ok: false,
      issues: [
        {
          filename: "-",
          message: `${assetCount} assets uploaded for a supply of ${maxSupply}. Upload ${maxSupply - assetCount} more, lower the supply, or enable reusable assets.`,
        },
      ],
    };
  }
  return { ok: true, issues: [] };
}

/** Derives a token number from `347.png`, falling back to upload order. */
export function tokenNumberFromFilename(filename: string, fallback: number): number {
  const base = filename.replace(/\.[^.]+$/, "");
  const match = /^(\d+)$/.exec(base.trim());
  return match ? Number(match[1]) : fallback;
}
