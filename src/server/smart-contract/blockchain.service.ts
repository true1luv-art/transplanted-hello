/**
 * Blockchain abstraction.
 *
 * The smart-contract worker depends on this interface only:
 *
 *   SmartContractWorker -> BlockchainService -> MockBlockchainService   (Phase 2)
 *   SmartContractWorker -> BlockchainService -> HiveBlockchainService   (Phase 3)
 *                                                    -> DHive / Hive Engine -> Hive
 */

export interface BlockchainResult {
  /** Mock in Phase 2 (MOCK-HIVE-XXXXXXXX), real Hive trx id in Phase 3. */
  hiveTransactionId: string;
  blockNumber: number;
  success: boolean;
  /** true while no real chain is involved — the UI labels these "Mock transaction". */
  mock: boolean;
}

export interface TransferParams {
  from: string;
  to: string;
  amount: number;
  currency: "HIVE";
  memo: string;
}

export interface DeployCollectionParams {
  creator: string;
  symbol: string;
  name: string;
  maxSupply: number;
}

export interface IssueNftParams {
  symbol: string;
  to: string;
  tokenId: number;
  metadataUri: string;
}

export interface TransferNftParams {
  symbol: string;
  from: string;
  to: string;
  tokenId: number;
}

export interface MarketParams {
  symbol: string;
  seller: string;
  tokenId: number;
  price: number;
}

export interface MarketBuyParams extends MarketParams {
  buyer: string;
}

export interface BlockchainService {
  readonly name: string;
  readonly isMock: boolean;
  transfer(params: TransferParams): Promise<BlockchainResult>;
  deployCollection(params: DeployCollectionParams): Promise<BlockchainResult>;
  issueNft(params: IssueNftParams): Promise<BlockchainResult>;
  transferNft(params: TransferNftParams): Promise<BlockchainResult>;
  sellNft(params: MarketParams): Promise<BlockchainResult>;
  cancelSell(params: MarketParams): Promise<BlockchainResult>;
  buyNft(params: MarketBuyParams): Promise<BlockchainResult>;
}
