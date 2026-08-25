/**
 * Canonical Hive NFT custom-property names.
 *
 * Hive property names cannot use the underscore form we previously had
 * (`collection_name`, `collection_symbol`, `nft_metadata`). The blockchain
 * facing schema is exactly three String properties:
 *
 *   collection  -> collection identifier / name
 *   symbol      -> collection symbol
 *   metadata    -> NFT metadata reference (IPFS URI / CID)
 *
 * These are the only names the app may create, write, or read.
 */

export const HIVE_NFT_PROPERTY_NAMES = ["collection", "symbol", "metadata"] as const;

export type HiveNftPropertyName = (typeof HIVE_NFT_PROPERTY_NAMES)[number];

export interface HiveNftPropertyDefinition {
  name: HiveNftPropertyName;
  type: "string";
  isReadOnly: boolean;
}

/** Property definitions used by the `nft.addProperty` setup transaction. */
export const HIVE_NFT_PROPERTY_DEFINITIONS: HiveNftPropertyDefinition[] =
  HIVE_NFT_PROPERTY_NAMES.map((name) => ({ name, type: "string", isReadOnly: false }));

export interface HiveNftProperties {
  collection: string;
  symbol: string;
  metadata: string;
}

/** Builds the compact per-token property values written on chain. */
export function buildHiveNftProperties(input: {
  collection: string;
  symbol: string;
  /** IPFS URI / CID of the token metadata document — never the full object. */
  metadataUri: string;
}): HiveNftProperties {
  return {
    collection: input.collection,
    symbol: input.symbol.toUpperCase(),
    metadata: input.metadataUri,
  };
}

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
 * Builds the per-token properties stored in the mock database.
 *
 * The chain requires every property value to be a STRING, so the NFT metadata
 * document is serialised here and parsed back with `parseNftMetadata` whenever
 * the application needs to work with it as an object.
 */
export function buildNftProperties(input: {
  collection: string;
  symbol: string;
  /** Metadata document (serialised here) or an already-serialised string. */
  metadata: unknown;
}): HiveNftProperties {
  return {
    collection: input.collection,
    symbol: input.symbol.toUpperCase(),
    metadata:
      typeof input.metadata === "string" ? input.metadata : JSON.stringify(input.metadata ?? {}),
  };
}

/** Parses `properties.metadata` back into an object. Never throws. */
export function parseNftMetadata(
  properties: Pick<HiveNftProperties, "metadata"> | null | undefined,
): Record<string, unknown> {
  if (!properties?.metadata) return {};
  try {
    const parsed: unknown = JSON.parse(properties.metadata);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
