import { buildNftProperties } from "@/lib/chain/nft-properties";
import { CREATOR_FEE_PERCENT, PLATFORM_FEE_PERCENT, RANK_POOL_CAP } from "@/lib/constants";
import { generateArtwork, hashString, mulberry32 } from "@/lib/art";
import { generateInventory } from "@/features/lib/traits/generator";
import { buildCollectionTraitLayers } from "@/features/lib/traits/presets";
import type { GeneratedToken, GeneratedTrait } from "@/features/lib/traits/types";
import type { Activity, Transaction } from "@/features/types/domain/activity";
import type { Collection } from "@/features/types/domain/collections";
import type { Listing } from "@/features/types/domain/marketplace";
import type { NFTAttribute } from "@/features/lib/metadata";
import type { NFT } from "@/features/types/domain/nfts";
import type { User } from "@/features/types/domain/users";
import { hiveAvatarUrl } from "@/lib/chain/identity";

/**
 * Ranking pool size cap. Rarity rank is computed across the whole collection,
 * but seeding 5,000 tokens per collection is wasteful for a prototype.
 */

/**
 * The mock session account is a REAL Hive account. Its profile, avatar, banner
 * and HIVE balance are hydrated from the chain at runtime; only the values
 * below are placeholders used before that first sync.
 */
export const MOCK_HIVE_USERNAME = "rhiaji";

export const CURRENT_USER: User = {
  username: MOCK_HIVE_USERNAME,
  displayName: MOCK_HIVE_USERNAME,
  avatarUrl: hiveAvatarUrl(MOCK_HIVE_USERNAME),
};

export const USERS = [MOCK_HIVE_USERNAME, "bob", "charlie", "david", "eve"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

interface CollectionSeed {
  name: string;
  symbol: string;
  creator: string;
  description: string;
  maxSupply: number;
  minted: number;
  mintPrice: number;
  floorPrice: number;
  volume: number;
  holders: number;
  createdDaysAgo: number;
  trendingScore: number;
  nouns: string[];
}

const COLLECTION_SEEDS: CollectionSeed[] = [
  {
    name: "CryptoCore Genesis",
    symbol: "CCG",
    creator: MOCK_HIVE_USERNAME,
    description:
      "The founding collection of the CryptoCore universe. 5,000 hand-tuned mining rigs, engineers and reactors powering the Hive economy.",
    maxSupply: 5000,
    minted: 4218,
    mintPrice: 5,
    floorPrice: 12.5,
    volume: 21480,
    holders: 1382,
    createdDaysAgo: 92,
    trendingScore: 98,
    nouns: ["Miner", "Reactor", "Engineer", "Node", "Core"],
  },
  {
    name: "Lucky Frogs",
    symbol: "FROG",
    creator: "bob",
    description:
      "3,000 amphibious optimists hopping across the Hive chain. Each frog carries its own luck rating and swamp lineage.",
    maxSupply: 3000,
    minted: 3000,
    mintPrice: 2.5,
    floorPrice: 6.25,
    volume: 11240,
    holders: 942,
    createdDaysAgo: 74,
    trendingScore: 71,
    nouns: ["Frog", "Toad", "Tadpole", "Croaker"],
  },
  {
    name: "Pixel Warriors",
    symbol: "PXWR",
    creator: "charlie",
    description:
      "A 4,000 piece pixel-art battle roster. Warriors are generated from 120 traits across weapons, armor and battle scars.",
    maxSupply: 4000,
    minted: 2611,
    mintPrice: 3.5,
    floorPrice: 8,
    volume: 9310,
    holders: 810,
    createdDaysAgo: 58,
    trendingScore: 86,
    nouns: ["Warrior", "Ranger", "Paladin", "Berserker"],
  },
  {
    name: "Hive Legends",
    symbol: "HLGD",
    creator: MOCK_HIVE_USERNAME,
    description:
      "Portraits of the Hive ecosystem's most storied characters, rendered as collectible on-chain cards.",
    maxSupply: 2000,
    minted: 1440,
    mintPrice: 8,
    floorPrice: 18.4,
    volume: 15220,
    holders: 604,
    createdDaysAgo: 41,
    trendingScore: 92,
    nouns: ["Legend", "Oracle", "Witness", "Founder"],
  },
  {
    name: "Cyber Hive",
    symbol: "CYBH",
    creator: "david",
    description:
      "Neon drone swarms and synthetic hives. A cyber-industrial series of neon industrial hardware.",
    maxSupply: 3500,
    minted: 1180,
    mintPrice: 4,
    floorPrice: 5.75,
    volume: 6120,
    holders: 431,
    createdDaysAgo: 27,
    trendingScore: 79,
    nouns: ["Drone", "Beast", "Sentinel", "Swarm"],
  },
  {
    name: "Genesis Beasts",
    symbol: "GBST",
    creator: "eve",
    description:
      "Mythical creatures forged in the first block. Genesis Beasts unlock in-game utility across partner Hive games.",
    maxSupply: 2500,
    minted: 2500,
    mintPrice: 6,
    floorPrice: 14.2,
    volume: 13980,
    holders: 722,
    createdDaysAgo: 65,
    trendingScore: 83,
    nouns: ["Beast", "Wyrm", "Griffin", "Titan"],
  },
  {
    name: "Solar Nomads",
    symbol: "SOLN",
    creator: "charlie",
    description:
      "Wanderers of the solar belt. A quiet, painterly collection focused on landscape and light.",
    maxSupply: 1500,
    minted: 612,
    mintPrice: 3,
    floorPrice: 4.1,
    volume: 2480,
    holders: 288,
    createdDaysAgo: 15,
    trendingScore: 64,
    nouns: ["Nomad", "Voyager", "Drifter", "Pilgrim"],
  },
  {
    name: "Block Botanica",
    symbol: "BOTA",
    creator: "bob",
    description:
      "Generative flora grown from block hashes. Every plant is a snapshot of the chain at mint time.",
    maxSupply: 1800,
    minted: 340,
    mintPrice: 2,
    floorPrice: 2.6,
    volume: 1410,
    holders: 196,
    createdDaysAgo: 6,
    trendingScore: 58,
    nouns: ["Bloom", "Fern", "Sprout", "Thorn"],
  },
];

const ADJECTIVES = ["Ancient", "Neon", "Prime", "Shadow", "Golden", "Frozen", "Solar"];
const TYPES = ["Mining Rig", "Companion", "Vehicle", "Artifact", "Guardian", "Relic"];

/**
 * Value multiplier derived from the token's rarity RANK PERCENTILE.
 * There are no rarity tiers — rarer rank simply means a higher multiplier.
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
  return traits.map((trait) => ({ trait_type: trait.layerName, value: trait.traitValueName }));
}

/**
 * Builds an NFT from an ALREADY GENERATED token. Traits, score, rank and class
 * are inputs here — this function never rolls rarity.
 */
export function buildNFT(params: {
  collection: Collection;
  mintNumber: number;
  owner: string;
  createdAt: string;
  token: GeneratedToken;
  rankTotal: number;
  seedKey: string;
  /** Chronological mint number inside the collection. */
  NFTMintedNumber: number;
  /** REAL blockchain token id (global across the platform collection). */
  tokenId: number;
}): NFT {
  const { collection, mintNumber, owner, createdAt, token, rankTotal, seedKey } = params;
  const rand = mulberry32(hashString(seedKey));
  const noun = collection.name.split(" ")[0] ?? "Token";
  const adj = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)] ?? "Prime";
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
    tokenId: params.tokenId,
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
    NFTMintedNumber: params.NFTMintedNumber,
    properties: buildNftProperties({
      collection: collection.name,
      symbol: collection.symbol,
      metadataUri: `${collection.metadataBaseUri}${fileNumber}.json`,
    }),
  };
}

export interface SeedData {
  collections: Collection[];
  nfts: NFT[];
  listings: Listing[];
  activities: Activity[];
  transactions: Transaction[];
}

export function createSeedData(): SeedData {
  const collections: Collection[] = COLLECTION_SEEDS.map((s, i) => ({
    id: `col-${i + 1}`,
    name: s.name,
    symbol: s.symbol,
    creator: s.creator,
    description: s.description,
    image: generateArtwork(`collection-${s.symbol}`),
    maxSupply: s.maxSupply,
    minted: s.minted,
    mintPrice: s.mintPrice,
    mintStartDate: null,
    mintEndDate: null,
    creatorFee: CREATOR_FEE_PERCENT,
    platformFee: PLATFORM_FEE_PERCENT,
    traitLayers: buildCollectionTraitLayers(`col-${i + 1}`, s.nouns),
    status: s.minted >= s.maxSupply ? "Sold Out" : "Minting",
    createdAt: ago(s.createdDaysAgo * DAY),
    floorPrice: s.floorPrice,
    volume: s.volume,
    holders: s.holders,
    trendingScore: s.trendingScore,
    metadataBaseUri: `https://meta.hivemint.app/${s.symbol.toLowerCase()}/`,
  }));

  const nfts: NFT[] = [];
  const rand = mulberry32(20260820);
  /** Blockchain token ids are global — one on-chain collection per platform. */
  let lastChainTokenId = 0;

  /**
   * Every catalogue NFT comes from a real weighted generation run, ranked
   * against its whole collection pool. Pools are capped so seeding stays fast.
   */
  collections.forEach((collection, ci) => {
    const poolSize = Math.min(collection.minted, RANK_POOL_CAP);
    const inventory = generateInventory({
      layers: collection.traitLayers,
      count: poolSize,
      seedKey: `${collection.id}-inventory`,
    });
    const perCollection = ci < 4 ? 9 : 7;

    let mintedInCollection = 0;
    for (let i = 0; i < perCollection; i++) {
      const token = inventory.tokens[Math.floor(rand() * inventory.tokens.length)];
      if (!token) continue;
      // Ensure the mock Hive account owns a healthy slice of the catalogue.
      const owner = i < 3 && ci < 5 ? MOCK_HIVE_USERNAME : (USERS[Math.floor(rand() * USERS.length)] ?? "bob");
      nfts.push(
        buildNFT({
          collection,
          mintNumber: token.tokenNumber,
          owner,
          token,
          rankTotal: poolSize,
          createdAt: ago(Math.floor(rand() * 40 * DAY) + HOUR),
          seedKey: `${collection.id}-seed-${i}`,
          NFTMintedNumber: ++mintedInCollection,
          tokenId: ++lastChainTokenId,
        }),
      );
    }

    // Showcase piece: the rarest token of the flagship collection.
    if (ci === 0) {
      const rarest = [...inventory.tokens].sort((a, b) => a.rarityRank - b.rarityRank)[0];
      if (rarest) {
        const showcase = buildNFT({
          collection,
          mintNumber: 1842,
          owner: MOCK_HIVE_USERNAME,
          token: rarest,
          rankTotal: poolSize,
          createdAt: ago(3 * DAY),
          NFTMintedNumber: ++mintedInCollection,
          tokenId: ++lastChainTokenId,
          seedKey: "showcase-1842",
        });
        showcase.name = `Genesis Miner #1842`;
        showcase.estimatedValue = 52;
        nfts.unshift(showcase);
      }
    }
  });

  // Deduplicate by id (random mint numbers may collide).
  const seen = new Set<string>();
  const uniqueNfts = nfts.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // Listings: sellers list NFTs they own (the mock account keeps a few unlisted).
  const listings: Listing[] = [];
  uniqueNfts.forEach((nft, i) => {
    const shouldList = nft.owner === MOCK_HIVE_USERNAME ? i % 7 === 3 : i % 3 !== 0;
    if (!shouldList || listings.length >= 24) return;
    const price = Number((nft.estimatedValue * (0.9 + rand() * 0.55)).toFixed(2));
    listings.push({
      id: `lst-${listings.length + 1}`,
      nftId: nft.id,
      seller: nft.owner,
      price,
      currency: "HIVE",
      listedAt: ago(Math.floor(rand() * 6 * DAY) + 10 * MINUTE),
      featured: listings.length < 4,
    });
    nft.status = "Listed";
  });

  const activities: Activity[] = [];
  const transactions: Transaction[] = [];
  const pushActivity = (a: Activity) => activities.push(a);

  collections.forEach((c, i) => {
    pushActivity({
      id: `act-col-${i}`,
      type: "Collection Created",
      actor: c.creator,
      collectionId: c.id,
      label: `@${c.creator} created ${c.name}`,
      amount: 25,
      txId: `MOCK-HIVE-${c.symbol}00${i}`,
      createdAt: c.createdAt,
    });
  });

  uniqueNfts.slice(0, 22).forEach((nft, i) => {
    pushActivity({
      id: `act-mint-${i}`,
      type: "Minted",
      actor: nft.owner,
      nftId: nft.id,
      collectionId: nft.collectionId,
      label: `@${nft.owner} minted ${nft.name}`,
      amount: collections.find((c) => c.id === nft.collectionId)?.mintPrice ?? 5,
      txId: `MOCK-HIVE-M${(1000 + i).toString(16).toUpperCase()}`,
      createdAt: nft.createdAt,
    });
  });

  listings.slice(0, 14).forEach((l, i) => {
    const nft = uniqueNfts.find((n) => n.id === l.nftId)!;
    pushActivity({
      id: `act-list-${i}`,
      type: "Listed",
      actor: l.seller,
      nftId: l.nftId,
      collectionId: nft.collectionId,
      label: `@${l.seller} listed ${nft.name}`,
      amount: l.price,
      txId: `MOCK-HIVE-L${(2000 + i).toString(16).toUpperCase()}`,
      createdAt: l.listedAt,
    });
  });

  // Historical sales (not tied to open listings).
  uniqueNfts.slice(4, 14).forEach((nft, i) => {
    const price = Number((nft.estimatedValue * 1.1).toFixed(2));
    const buyer = USERS[(i + 1) % USERS.length] ?? "bob";
    pushActivity({
      id: `act-sale-${i}`,
      type: "Sold",
      actor: buyer,
      target: nft.owner,
      nftId: nft.id,
      collectionId: nft.collectionId,
      label: `@${buyer} purchased ${nft.name}`,
      amount: price,
      txId: `MOCK-HIVE-S${(3000 + i).toString(16).toUpperCase()}`,
      createdAt: ago(Math.floor(rand() * 5 * DAY) + 20 * MINUTE),
    });
    transactions.push({
      id: `tx-${i + 1}`,
      txId: `MOCK-HIVE-S${(3000 + i).toString(16).toUpperCase()}`,
      type: "sale",
      from: buyer,
      to: nft.owner,
      amount: price,
      memo: `Secondary sale · ${nft.name}`,
      createdAt: ago(Math.floor(rand() * 5 * DAY) + 20 * MINUTE),
    });
  });

  transactions.push(
    {
      id: "tx-100",
      txId: "MOCK-HIVE-7F82A91C",
      type: "mint",
      from: MOCK_HIVE_USERNAME,
      to: "hivemint",
      amount: 5.25,
      memo: "Mint · CryptoCore Genesis",
      createdAt: ago(3 * DAY),
    },
    {
      id: "tx-101",
      txId: "MOCK-HIVE-2B41D0E8",
      type: "collection_create",
      from: MOCK_HIVE_USERNAME,
      to: "hivemint",
      amount: 25,
      memo: "Collection deployment · Hive Legends",
      createdAt: ago(41 * DAY),
    },
  );

  activities.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  transactions.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return { collections, nfts: uniqueNfts, listings, activities, transactions };
}
