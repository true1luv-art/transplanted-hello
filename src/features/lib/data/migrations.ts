/**
 * Mock-database schema versions and DATA-PRESERVING migrations.
 *
 * The LocalStorage database is versioned. On startup the persisted payload is
 * compared against `DB_VERSION`; anything older is transformed in place —
 * never wiped and never recreated. Migrations are pure and deterministic so
 * the same stored payload copied into a cloned project migrates identically.
 *
 * v1 -> v2
 *   - every NFT asset gains `NftMintedNumber: null` (blockchain id only exists after
 *     a mint) and a blockchain-shaped `properties` object
 *     (`{ collection, symbol, metadata }` where metadata is a JSON STRING).
 *   - already-minted NFTs keep their ids and gain `NftMintedNumber` + `properties`.
 *   - the legacy `unminted[collectionId]` NFT pools are converted into
 *     `nftAssets` rows (unminted inventory) instead of being dropped.
 */
import {
  buildNftProperties,
  type HiveNftProperties,
} from "@/lib/chain/nft-properties";
import type { NftAsset } from "@/features/types/domain/nft-assets";
import type { NFT } from "@/features/types/domain/nfts";
import type { Collection } from "@/features/types/domain/collections";

export const DB_VERSION = 4;

type Loose = Record<string, unknown>;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const symbolFor = (collections: Collection[], collectionId: string, fallback: string): string => {
  const collection = collections.find((c) => c.id === collectionId);
  return (collection?.symbol ?? fallback ?? "").toUpperCase();
};

const nameFor = (collections: Collection[], collectionId: string, fallback: string): string =>
  collections.find((c) => c.id === collectionId)?.name ?? fallback ?? "";

/** Rebuilds blockchain-shaped properties from whatever the record carries. */
function propertiesFor(record: Loose, collectionName: string, symbol: string): HiveNftProperties {
  const existing = record["properties"] as Loose | undefined;
  if (
    existing &&
    typeof existing["symbol"] === "string" &&
    typeof existing["metadata"] === "string"
  ) {
    return existing as unknown as HiveNftProperties;
  }
  return buildNftProperties({
    collection: collectionName,
    symbol,
    metadata: {
      name: String(record["name"] ?? ""),
      description: String(record["description"] ?? ""),
      image: String(record["imageUri"] ?? record["image"] ?? ""),
      attributes: asArray(record["attributes"]),
    },
  });
}

/** v1 -> v2 upgrade of a persisted payload. Unknown fields are preserved. */
export function migrateV1ToV2(state: Loose): Loose {
  const collections = asArray<Collection>(state["collections"]);
  const legacyPools = (state["unminted"] as Record<string, Loose[]> | undefined) ?? {};

  const assets: NftAsset[] = asArray<Loose>(state["nftAssets"]).map((asset) => {
    const collectionId = String(asset["collectionId"] ?? "");
    const symbol = symbolFor(collections, collectionId, String(asset["symbol"] ?? ""));
    const collectionName = nameFor(collections, collectionId, String(asset["collectionName"] ?? ""));
    return {
      ...(asset as unknown as NftAsset),
      NFTokenID: null,
      NftMintedNumber: null,
      properties: propertiesFor(asset, collectionName, symbol),
    };
  });

  // Legacy imported pools become unminted assets rather than being discarded.
  for (const [collectionId, pool] of Object.entries(legacyPools)) {
    for (const nft of asArray<Loose>(pool)) {
      const symbol = symbolFor(collections, collectionId, "");
      const collectionName = nameFor(collections, collectionId, String(nft["collectionName"] ?? ""));
      const mintId = Number(nft["NFTMintId"] ?? nft["mintNumber"] ?? nft["tokenId"] ?? 0);
      if (assets.some((a) => a.collectionId === collectionId && a.NFTMintId === mintId)) continue;
      assets.push({
        id: String(nft["id"] ?? `asset-${collectionId}-${mintId}`),
        collectionId,
        NFTMintId: mintId,
        NFTokenID: null,
        NftMintedNumber: null,
        name: String(nft["name"] ?? ""),
        description: String(nft["description"] ?? ""),
        filename: `${mintId}.png`,
        mimeType: "image/png",
        size: 0,
        imageCid: nft["imageCid"] as string | undefined,
        metadataCid: nft["metadataCid"] as string | undefined,
        imageRootCid: nft["imageRootCid"] as string | undefined,
        metadataRootCid: nft["metadataRootCid"] as string | undefined,
        imageUri: (nft["image"] as string | undefined) ?? undefined,
        metadataUri: (nft["metadataUri"] as string | undefined) ?? undefined,
        cid: nft["imageCid"] as string | undefined,
        attributes: asArray(nft["attributes"]),
        rarityScore: nft["rarityScore"] as number | undefined,
        rarityRank: nft["rarityRank"] as number | undefined,
        rarityRankTotal: nft["rarityRankTotal"] as number | undefined,
        status: "uploaded",
        createdAt: String(nft["createdAt"] ?? new Date(0).toISOString()),
        updatedAt: new Date(0).toISOString(),
        properties: propertiesFor(nft, collectionName, symbol),
      });
    }
  }

  const nfts: NFT[] = asArray<Loose>(state["nfts"]).map((nft) => {
    const collectionId = String(nft["collectionId"] ?? "");
    const symbol = symbolFor(collections, collectionId, String(nft["symbol"] ?? ""));
    const collectionName = nameFor(collections, collectionId, String(nft["collectionName"] ?? ""));
    const minted =
      (nft["NftMintedNumber"] as number | null | undefined) ??
      (nft["NFTokenID"] as number | null | undefined) ??
      (typeof nft["tokenId"] === "number" ? (nft["tokenId"] as number) : null);
    return {
      ...(nft as unknown as NFT),
      NftMintedNumber: minted ?? null,
      properties: propertiesFor(nft, collectionName, symbol),
    };
  });

  return { ...state, nftAssets: assets, nfts, unminted: {} };
}

/**
 * v2 -> v3
 *   - `NFTMinted` is renamed to `NftMintedNumber` and re-scoped: it is the
 *     CHRONOLOGICAL mint number inside its own collection, not a chain id.
 *   - `tokenId` becomes the REAL blockchain token id (`null` when unminted);
 *     the file/image number lives on in `mintNumber` / `NFTMintId`.
 */
export function migrateV2ToV3(state: Loose): Loose {
  const assets = asArray<Loose>(state["nftAssets"]).map((asset) => {
    const { NFTMinted: legacyMinted, ...rest } = asset as Loose & { NFTMinted?: unknown };
    return {
      ...rest,
      NftMintedNumber:
        (rest["NftMintedNumber"] as number | null | undefined) ??
        (typeof legacyMinted === "number" ? legacyMinted : null),
      NFTokenID: (rest["NFTokenID"] as number | null | undefined) ?? null,
    } as Loose;
  });

  const counters = new Map<string, number>();
  const nfts = asArray<Loose>(state["nfts"]).map((nft) => {
    const { NFTMinted, ...rest } = nft as Loose & { NFTMinted?: unknown };
    const collectionId = String(rest["collectionId"] ?? "");
    const next = (counters.get(collectionId) ?? 0) + 1;
    counters.set(collectionId, next);
    const existing = rest["NftMintedNumber"];
    return {
      ...rest,
      // Legacy payloads stored mint order in `NFTMinted`; keep it when present.
      NftMintedNumber:
        typeof existing === "number"
          ? existing
          : typeof NFTMinted === "number"
            ? NFTMinted
            : next,
      // The blockchain id is unknown for legacy rows until re-indexed.
      tokenId: typeof rest["tokenId"] === "number" ? rest["tokenId"] : null,
    } as Loose;
  });

  return { ...state, nftAssets: assets, nfts };
}

/**
 * v3 -> v4
 *   - adds the `mintTransactions` journal used by the REAL Hive mint flow.
 *   - existing rows are untouched: generated assets stay unminted
 *     (`NftMintedNumber: null`, `NFTokenID: null`) and previously minted MOCK
 *     NFTs keep their data but are flagged `mock: true` instead of being
 *     presented as real Hive tokens.
 */
export function migrateV3ToV4(state: Loose): Loose {
  const nfts = asArray<Loose>(state["nfts"]).map((nft) => {
    const transaction = nft["transaction"] as Loose | undefined;
    const txId = String(transaction?.["txId"] ?? "");
    // Real Hive transaction ids are 40 hex chars; anything else is mock data.
    const isReal = /^[0-9a-f]{40}$/i.test(txId);
    return { ...nft, mock: nft["mock"] === true ? true : !isReal } as Loose;
  });
  return {
    ...state,
    nfts,
    mintTransactions: asArray(state["mintTransactions"]),
  };
}

/** Runs every migration needed to bring `state` up to `DB_VERSION`. */
export function migrateAppData(state: unknown, fromVersion: number): unknown {
  if (!state || typeof state !== "object") return state;
  let current = state as Loose;
  let version = fromVersion;
  if (version < 2) {
    current = migrateV1ToV2(current);
    version = 2;
  }
  if (version < 3) {
    current = migrateV2ToV3(current);
    version = 3;
  }
  if (version < 4) {
    current = migrateV3ToV4(current);
    version = 4;
  }
  return current;
}
