/**
 * Pre-generation and pre-export validation.
 *
 * Errors block the action; warnings are informational only.
 */
import { selectableValues, totalWeight } from "@/features/lib/traits/weighted-random";
import { activeLayers, maxCombinations } from "./engine";
import { BATCH_SIZE } from "./batching";
import { MAX_COLLECTION_SIZE, MAX_DIMENSION, MIN_DIMENSION } from "./types";
import type {
  GenerationResult,
  GenerationValidationError,
  GeneratorProject,
  GeneratorSettings,
} from "./types";
import { filePrefix } from "./naming";

export function validateProject(project: GeneratorProject): GenerationValidationError[] {
  const issues: GenerationValidationError[] = [];
  const { settings, layers } = project;

  if (!settings.name.trim()) {
    issues.push({
      code: "NAME_REQUIRED",
      severity: "error",
      message: "Collection name is required",
    });
  }
  if (!Number.isFinite(settings.supply) || settings.supply < 1) {
    issues.push({
      code: "SUPPLY_INVALID",
      severity: "error",
      message: "Collection size must be at least 1",
    });
  } else if (settings.supply > MAX_COLLECTION_SIZE) {
    issues.push({
      code: "SUPPLY_INVALID",
      severity: "error",
      message: `Collection size cannot exceed ${MAX_COLLECTION_SIZE} NFTs per generation`,
    });
  }

  for (const [label, value] of [
    ["Width", settings.width],
    ["Height", settings.height],
  ] as const) {
    if (!Number.isFinite(value) || value < MIN_DIMENSION || value > MAX_DIMENSION) {
      issues.push({
        code: "DIMENSION_INVALID",
        severity: "error",
        message: `${label} must be between ${MIN_DIMENSION}px and ${MAX_DIMENSION}px`,
      });
    }
  }

  const enabled = layers.filter((layer) => layer.enabled);
  if (enabled.length === 0) {
    issues.push({
      code: "NO_LAYERS",
      severity: "error",
      message: "Add at least one enabled layer",
    });
  }

  for (const layer of enabled) {
    if (layer.traits.length === 0) {
      issues.push({
        code: "EMPTY_LAYER",
        severity: "error",
        message: `Layer "${layer.name}" has no uploaded traits`,
        subject: layer.name,
      });
      continue;
    }
    for (const trait of layer.traits) {
      if (Number.isFinite(trait.weight) && trait.weight < 0) {
        issues.push({
          code: "NEGATIVE_WEIGHT",
          severity: "error",
          message: `Negative weight on "${trait.name}" in "${layer.name}"`,
          subject: layer.name,
        });
      }
      if (!trait.src) {
        issues.push({
          code: "MISSING_ASSET",
          severity: "error",
          message: `Missing image asset for "${trait.name}" in "${layer.name}"`,
          subject: trait.name,
        });
      }
    }
    if (totalWeight(layer.traits) <= 0) {
      issues.push({
        code: "ZERO_TOTAL_WEIGHT",
        severity: "error",
        message: `Layer "${layer.name}" has no selectable trait (total weight is zero)`,
        subject: layer.name,
      });
    } else if (selectableValues(layer.traits).length === 1) {
      issues.push({
        code: "EMPTY_LAYER",
        severity: "warning",
        message: `Layer "${layer.name}" has only one selectable trait — every NFT will share it`,
        subject: layer.name,
      });
    }
  }

  const possible = maxCombinations(layers);
  if (activeLayers(layers).length > 0 && settings.supply > possible) {
    issues.push({
      code: "INSUFFICIENT_COMBINATIONS",
      severity: "error",
      message: `Possible unique combinations: ${possible} · Requested supply: ${settings.supply}`,
    });
  }

  return issues;
}

export function validateGeneration(
  result: GenerationResult | null,
  options: { batchSize?: number; settings?: GeneratorSettings } = {},
): GenerationValidationError[] {
  const issues: GenerationValidationError[] = [];
  if (!result || result.nfts.length === 0) {
    return [
      {
        code: "NOT_GENERATED",
        severity: "error",
        message: "Generate the collection before exporting",
      },
    ];
  }

  const tokenIds = new Set<number>();
  const dna = new Set<string>();
  for (const nft of result.nfts) {
    if (tokenIds.has(nft.tokenId)) {
      issues.push({
        code: "DUPLICATE_TOKEN_ID",
        severity: "error",
        message: `Duplicate token ID #${nft.tokenId}`,
        subject: String(nft.tokenId),
      });
    }
    tokenIds.add(nft.tokenId);

    if (dna.has(nft.dna)) {
      issues.push({
        code: "DUPLICATE_DNA",
        severity: "error",
        message: `Duplicate trait combination on #${nft.tokenId}`,
        subject: String(nft.tokenId),
      });
    }
    dna.add(nft.dna);

    if (!nft.previewUrl) {
      issues.push({
        code: "MISSING_IMAGE",
        severity: "warning",
        message: `No composited image for #${nft.tokenId}`,
        subject: String(nft.tokenId),
      });
    }
  }

  // Filenames must be driven by the configured Item Name Prefix, and every
  // image must own exactly one metadata document with a matching basename.
  const prefix = options.settings ? filePrefix(options.settings) : null;
  const basenames = new Set<string>();
  for (const nft of result.nfts) {
    const imageBase = nft.imageFilename.replace(/\.png$/i, "");
    const metaBase = nft.metadataFilename.replace(/\.json$/i, "");
    if (imageBase !== metaBase) {
      issues.push({
        code: "MISSING_IMAGE",
        severity: "error",
        message: `Image and metadata filenames differ for #${nft.tokenId}`,
        subject: String(nft.tokenId),
      });
    }
    if (basenames.has(imageBase)) {
      issues.push({
        code: "ORPHAN_IMAGE",
        severity: "error",
        message: `Duplicate filename "${nft.imageFilename}"`,
        subject: nft.imageFilename,
      });
    }
    basenames.add(imageBase);
    if (prefix && imageBase !== `${prefix}${nft.tokenId}`) {
      issues.push({
        code: "ORPHAN_IMAGE",
        severity: "error",
        message: `Filename "${nft.imageFilename}" does not use the item name prefix "${prefix}"`,
        subject: nft.imageFilename,
      });
    }
  }

  const size = options.batchSize ?? BATCH_SIZE;
  if (size > BATCH_SIZE) {
    issues.push({
      code: "BATCH_TOO_LARGE",
      severity: "error",
      message: `Batches cannot exceed ${BATCH_SIZE} NFTs`,
    });
  }

  return issues;
}

export const hasBlockingErrors = (issues: GenerationValidationError[]): boolean =>
  issues.some((issue) => issue.severity === "error");
