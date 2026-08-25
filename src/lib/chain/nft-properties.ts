/**
 * Canonical Hive NFT custom-property names.
 *
 * Hive property names cannot use the underscore form we previously had
 * (`collection_name`, `collection_symbol`, `nft_metadata`). The blockchain
 * facing schema is exactly three String properties:
 *
 *   collection  -> CREATOR collection name           (e.g. "Otters Outbreak")
 *   symbol      -> CREATOR collection symbol         (e.g. "OO")
 *   metadata    -> IPFS URI of the metadata document (e.g. "ipfs://Qm…/1.json")
 *
 * These are the only names the app may create, write, or read.
 *
 * IMPORTANT — two different symbols exist in this system:
 *   - PLATFORM_NFT_SYMBOL (e.g. TESTNFTS) is the Hive Engine NFT contract the
 *     platform issues into. It belongs in `contractPayload.symbol` ONLY.
 *   - The creator collection symbol (e.g. OO) belongs in `properties.symbol`.
 * They must never be swapped.
 *
 * Hive Engine limits every string property to 100 characters, so the FULL
 * metadata document is never written on chain — only its IPFS URI.
 */

export const HIVE_NFT_PROPERTY_NAMES = ["collection", "symbol", "metadata"] as const;

export type HiveNftPropertyName = (typeof HIVE_NFT_PROPERTY_NAMES)[number];

/** Hive Engine hard limit for a String NFT property value. */
export const HIVE_NFT_PROPERTY_MAX_LENGTH = 100;

export interface HiveNftPropertyDefinition {
  name: HiveNftPropertyName;
  type: "string";
  isReadOnly: boolean;
}

/** Property definitions used by the `nft.addProperty` setup transaction. */
export const HIVE_NFT_PROPERTY_DEFINITIONS: HiveNftPropertyDefinition[] =
  HIVE_NFT_PROPERTY_NAMES.map((name) => ({ name, type: "string", isReadOnly: false }));

export interface HiveNftProperties {
  /** Creator collection name. */
  collection: string;
  /** Creator collection symbol — NEVER the platform NFT symbol. */
  symbol: string;
  /** IPFS URI of the metadata JSON — NEVER the serialized metadata itself. */
  metadata: string;
}

export interface BuildHiveNftPropertiesInput {
  collection: string;
  symbol: string;
  /** IPFS URI / CID of the token metadata document — never the full object. */
  metadataUri: string;
}

/** Builds the compact per-token property values written on chain. */
export function buildHiveNftProperties(input: BuildHiveNftPropertiesInput): HiveNftProperties {
  return {
    collection: input.collection,
    symbol: input.symbol.toUpperCase(),
    metadata: input.metadataUri,
  };
}

/**
 * Alias kept for the application/local-database side, which stores exactly the
 * same blockchain-shaped object.
 */
export const buildNftProperties = buildHiveNftProperties;

export function isHiveNftPropertyName(value: string): value is HiveNftPropertyName {
  return (HIVE_NFT_PROPERTY_NAMES as readonly string[]).includes(value);
}

/** Rejects any payload that carries legacy or unknown property names. */
export function assertCanonicalProperties(properties: Record<string, unknown>): void {
  const unknown = Object.keys(properties).filter((key) => !isHiveNftPropertyName(key));
  if (unknown.length) {
    throw new Error(
      `Unsupported Hive NFT property name(s): ${unknown.join(", ")}. Allowed: ${HIVE_NFT_PROPERTY_NAMES.join(", ")}`,
    );
  }
}

/**
 * Enforces the Hive Engine 100-character String property limit and rejects a
 * `metadata` value that is a serialized document instead of an IPFS URI.
 * Throws with a readable message so the UI can surface it before broadcasting.
 */
export function assertPropertyLimits(properties: HiveNftProperties): void {
  for (const name of HIVE_NFT_PROPERTY_NAMES) {
    const value = properties[name];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Hive NFT property "${name}" is empty`);
    }
    if (value.length > HIVE_NFT_PROPERTY_MAX_LENGTH) {
      throw new Error(
        `Hive NFT property "${name}" is ${value.length} characters — the Hive Engine limit is ${HIVE_NFT_PROPERTY_MAX_LENGTH}`,
      );
    }
  }
  const metadata = properties.metadata.trim();
  if (metadata.startsWith("{") || metadata.startsWith("[")) {
    throw new Error(
      "Hive NFT property \"metadata\" must be the IPFS URI of the metadata JSON, not the metadata itself",
    );
  }
}

/** true when the value looks like an IPFS reference the chain can carry. */
export function isMetadataUri(value: string): boolean {
  const uri = value.trim();
  if (!uri || uri.length > HIVE_NFT_PROPERTY_MAX_LENGTH) return false;
  return /^ipfs:\/\/.+/i.test(uri) || /^https?:\/\/.+/i.test(uri) || /^(Qm|bafy)\w+/.test(uri);
}
