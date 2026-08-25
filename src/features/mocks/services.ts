import { mockTxId } from "@/lib/art";
import { MOCK_HIVE_USERNAME } from "@/features/lib/data/seed-data";
import { RANK_POOL_CAP } from "@/lib/constants";
import { generateInventory } from "@/features/lib/traits/generator";
import type { GeneratedToken } from "@/features/lib/traits/types";
import type { Collection } from "@/features/types/domain/collections";
import type { NFT } from "@/features/types/domain/nfts";
import { quoteListing, quoteMint, quotePurchase } from "@/features/mocks/data/marketplace/model";
import type { DatabaseService, HiveService, MarketplaceService } from "@/features/types/services";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockHiveService implements HiveService {
  async connect(username = MOCK_HIVE_USERNAME) {
    await delay(700);
    return { username, balance: 125.5 };
  }
  async disconnect() {
    await delay(150);
  }
  async getBalance() {
    await delay(100);
    return 125.5;
  }
  async transfer(_from: string, _to: string, _amount: number, _memo: string) {
    await delay(500);
    return {
      txId: mockTxId(),
      success: true,
      blockNumber: 88_000_000 + Math.floor(Math.random() * 9999),
    };
  }
  /**
   * Highest token id the mock chain has ever issued, across EVERY collection —
   * the platform owns a single on-chain collection, so token ids are global.
   */
  private lastTokenId = 0;

  /** Mirrors reading the chain state before issuing (indexer bootstrap). */
  syncTokenCounter(highestKnownTokenId: number) {
    this.lastTokenId = Math.max(this.lastTokenId, highestKnownTokenId);
  }

  async issueNft(_symbol: string, _to: string, tokenId?: number) {
    await delay(600);
    const issued = tokenId ?? this.lastTokenId + 1;
    this.lastTokenId = Math.max(this.lastTokenId, issued);
    return {
      txId: mockTxId(),
      success: true,
      blockNumber: 88_000_000 + Math.floor(Math.random() * 9999),
      tokenId: issued,
    };
  }
}

export class MockDatabaseService implements DatabaseService {
  async saveCollection(collection: Collection) {
    await delay(120);
    return collection;
  }
  async saveNft(nft: NFT) {
    await delay(120);
    return nft;
  }
  async nextMintedNumber(collection: Collection) {
    await delay(60);
    return collection.minted + 1;
  }
}

export class MockMarketplaceService implements MarketplaceService {
  async quoteMint(collection: Collection) {
    return quoteMint(collection);
  }
  async quoteListing(price: number) {
    return quoteListing(price);
  }
  async quotePurchase(price: number) {
    return quotePurchase(price);
  }
  /**
   * Generates one token's traits with the collection's own weights, then ranks
   * it against a freshly generated sample of the collection so the derived
   * rarity class is meaningful.
   */
  async generateToken(collection: Collection, tokenNumber: number): Promise<GeneratedToken> {
    const poolSize = Math.max(1, Math.min(collection.maxSupply, RANK_POOL_CAP));
    const inventory = generateInventory({
      layers: collection.traitLayers,
      count: poolSize,
      seedKey: `${collection.id}-mint-${tokenNumber}-${Date.now()}`,
    });
    const token = inventory.tokens[0]!;
    return { ...token, tokenNumber };
  }
}

export const mockHiveService = new MockHiveService();
export const hiveService: HiveService = mockHiveService;
export const databaseService: DatabaseService = new MockDatabaseService();
export const marketplaceService: MarketplaceService = new MockMarketplaceService();

export type { DatabaseService, HiveService, MarketplaceService } from "@/features/types/services";
