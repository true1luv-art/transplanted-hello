import { config } from "@/lib/config/config";
import { logger } from "@/lib/config/logger";
import type {
  BlockchainResult,
  BlockchainService,
  DeployCollectionParams,
  IssueNftParams,
  MarketBuyParams,
  MarketParams,
  TransferNftParams,
  TransferParams,
} from "@/server/smart-contract/blockchain.service";

function mockHiveTransactionId(): string {
  const chars = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `MOCK-HIVE-${out}`;
}

let blockCursor = 89_000_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulated Hive / Hive Engine operations. No keys, no network, no broadcast.
 * Every result is explicitly flagged `mock: true`.
 */
export class MockBlockchainService implements BlockchainService {
  readonly name = "MockBlockchainService";
  readonly isMock = true;

  private async op(operation: string, detail: Record<string, unknown>): Promise<BlockchainResult> {
    await delay(config.blockchainLatency);
    blockCursor += 1 + Math.floor(Math.random() * 3);
    const result: BlockchainResult = {
      hiveTransactionId: mockHiveTransactionId(),
      blockNumber: blockCursor,
      success: true,
      mock: true,
    };
    logger.info("BLOCKCHAIN:MOCK", `${operation} -> ${result.hiveTransactionId}`, detail);
    return result;
  }

  transfer(params: TransferParams) {
    return this.op("transfer", {
      from: params.from,
      to: params.to,
      amount: `${params.amount} ${params.currency}`,
      memo: params.memo,
    });
  }

  deployCollection(params: DeployCollectionParams) {
    return this.op("nft_create", {
      symbol: params.symbol,
      creator: params.creator,
      maxSupply: params.maxSupply,
    });
  }

  issueNft(params: IssueNftParams) {
    return this.op("nft_issue", { symbol: params.symbol, to: params.to, tokenId: params.tokenId });
  }

  transferNft(params: TransferNftParams) {
    return this.op("nft_transfer", {
      symbol: params.symbol,
      from: params.from,
      to: params.to,
      tokenId: params.tokenId,
    });
  }

  sellNft(params: MarketParams) {
    return this.op("nftmarket_sell", {
      symbol: params.symbol,
      seller: params.seller,
      price: params.price,
    });
  }

  cancelSell(params: MarketParams) {
    return this.op("nftmarket_cancel", {
      symbol: params.symbol,
      seller: params.seller,
      tokenId: params.tokenId,
    });
  }

  buyNft(params: MarketBuyParams) {
    return this.op("nftmarket_buy", {
      symbol: params.symbol,
      buyer: params.buyer,
      price: params.price,
    });
  }
}
