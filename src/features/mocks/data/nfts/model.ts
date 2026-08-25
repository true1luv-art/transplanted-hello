import { generateArtwork, hashString, mulberry32 } from "@/lib/art";
import { buildNftProperties } from "@/lib/chain/nft-properties";
import type { GeneratedToken, GeneratedTrait } from "@/features/lib/traits/types";
import type { Collection } from "@/features/types/domain/collections";
import type { NFT, NFTAttribute } from "@/features/types/domain/nfts";

const ADJECTIVES = ["Ancient", "Neon", "Prime", "Shadow", "Golden", "Frozen", "Solar"];

/**
 * Value multiplier derived from the token's rarity RANK PERCENTILE.
 * There are no rarity tiers — a rarer rank simply means a higher multiplier.
 */
export function rarityMultiplier(rank: number, total: number): number {
  if (!total || !rank) return 1.15;
  const percentile = rank / total;
  if (percentile <= 0.01) return 10;
  if (percentile <= 0.05) return 5;
  if (percentile <= 0.15) return 2.4;
  return 1.15;
}

/** Generated traits -> metadata attributes. Attributes always mirror traits. */
export function traitsToAttributes(traits: GeneratedTrait[]): NFTAttribute[] {
  return traits.map((trait) => ({ trait: trait.layerName, value: trait.traitValueName }));
}

/**
 * Builds an NFT from an ALREADY GENERATED token. Traits, score and rank are
 * inputs here — this function never rolls rarity.
 */
export function buildNFT(params: {
  collection: Collection;
  mintNumber: number;
  owner: string;
  createdAt: string;
  token: GeneratedToken;
  rankTotal: number;
  seedKey: string;
  /** Chronological mint number inside the collection. `null` for previews. */
  NftMintedNumber?: number | null;
  /** REAL blockchain token id read back from the chain. `null` if unminted. */
  tokenId?: number | null;
}): NFT {
  const { collection, mintNumber, owner, createdAt, token, rankTotal, seedKey } = params;
  const rand = mulberry32(hashString(seedKey));
  const noun = collection.name.split(" ")[0] ?? "Token";
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)] ?? "Prime";
  // File/image number — used for names, ids and metadata paths only.
  const fileNumber = mintNumber;
  const value = Number(
    (
      collection.mintPrice *
      rarityMultiplier(token.rarityRank, rankTotal) *
      (0.85 + rand() * 0.5)
    ).toFixed(2),
  );
  const traitSummary = token.traits
    .filter((t) => t.traitValueName !== "None")
    .slice(0, 3)
    .map((t) => t.traitValueName)
    .join(", ");

  return {
    id: `${collection.id}-${fileNumber}`,
    collectionId: collection.id,
    collectionName: collection.name,
    tokenId: params.tokenId ?? null,
    name: `${adj} ${noun} #${fileNumber}`,
    description: `${traitSummary || "A unique combination"} — rank #${token.rarityRank} of ${rankTotal} in ${collection.name}. Minted through the HiveMint launchpad and secured as a Hive Engine NFT.`,
    image: generateArtwork(`${collection.id}-${fileNumber}`),
    traits: token.traits,
    rarityScore: token.rarityScore,
    rarityRank: token.rarityRank,
    rarityRankTotal: rankTotal,
    mintNumber,
    maxSupply: collection.maxSupply,
    owner,
    attributes: traitsToAttributes(token.traits),
    metadataUri: `${collection.metadataBaseUri}${fileNumber}.json`,
    estimatedValue: value,
    createdAt,
    status: "Owned",
    NftMintedNumber: params.NftMintedNumber ?? null,
    properties: buildNftProperties({
      collection: collection.name,
      symbol: collection.symbol,
      metadata: {
        name: `${adj} ${noun} #${fileNumber}`,
        description: `Rank #${token.rarityRank} of ${rankTotal} in ${collection.name}.`,
        image: `${collection.metadataBaseUri}${fileNumber}.json`,
        attributes: traitsToAttributes(token.traits),
      },
    }),
  };
}

/** Post-sale estimated value for a purchased token. */
export function repriceAfterSale(nft: NFT, salePrice: number): number {
  const premium = rarityMultiplier(nft.rarityRank, nft.rarityRankTotal) > 4 ? 1.05 : 1;
  return Number((salePrice * 1.05 * premium).toFixed(2));
}
