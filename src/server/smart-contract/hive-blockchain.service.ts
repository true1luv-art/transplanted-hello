/**
 * Real Hive implementation of `BlockchainService`.
 *
 * Phase 6B scope: the generic foundation only.
 *   server/smart-contract -> HiveBlockchainService -> lib/chain/hive.ts -> Hive
 *
 * `transfer` is a plain Hive operation and is implemented. Every NFT /
 * collection / marketplace operation intentionally throws until the
 * corresponding phase implements it — no business logic lives here.
 *
 * SERVER-ONLY. All chain access goes through `lib/chain/hive.ts`; this file
 * never imports dHive directly and never touches private keys.
 */
import { broadcastOperations, isBroadcastConfigured } from "@/lib/chain/hive";
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
} from "./blockchain.service";

export class HiveOperationNotImplementedError extends Error {
  readonly code = "HIVE_OPERATION_NOT_IMPLEMENTED";
  constructor(operation: string) {
    super(`Hive operation "${operation}" is not implemented yet (Phase 6C+)`);
    this.name = "HiveOperationNotImplementedError";
  }
}

const asset = (amount: number, currency: string) => `${amount.toFixed(3)} ${currency}`;

export class HiveBlockchainService implements BlockchainService {
  readonly name = "HiveBlockchainService";
  readonly isMock = false;

  /** true when the backend is allowed to sign and broadcast. */
  canBroadcast(): boolean {
    return isBroadcastConfigured();
  }

  async transfer(params: TransferParams): Promise<BlockchainResult> {
    logger.info("BLOCKCHAIN:HIVE", "transfer", {
      from: params.from,
      to: params.to,
      amount: asset(params.amount, params.currency),
    });
    const result = await broadcastOperations([
      [
        "transfer",
        {
          from: params.from,
          to: params.to,
          amount: asset(params.amount, params.currency),
          memo: params.memo,
        },
      ],
    ]);
    return {
      hiveTransactionId: result.transactionId,
      blockNumber: result.blockNumber ?? 0,
      success: result.success,
      mock: false,
    };
  }

  deployCollection(_params: DeployCollectionParams): Promise<BlockchainResult> {
    throw new HiveOperationNotImplementedError("deployCollection");
  }

  issueNft(_params: IssueNftParams): Promise<BlockchainResult> {
    throw new HiveOperationNotImplementedError("issueNft");
  }

  transferNft(_params: TransferNftParams): Promise<BlockchainResult> {
    throw new HiveOperationNotImplementedError("transferNft");
  }

  sellNft(_params: MarketParams): Promise<BlockchainResult> {
    throw new HiveOperationNotImplementedError("sellNft");
  }

  cancelSell(_params: MarketParams): Promise<BlockchainResult> {
    throw new HiveOperationNotImplementedError("cancelSell");
  }

  buyNft(_params: MarketBuyParams): Promise<BlockchainResult> {
    throw new HiveOperationNotImplementedError("buyNft");
  }
}
