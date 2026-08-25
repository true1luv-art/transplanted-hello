/**
 * server/smart-contract/services/expectations.ts
 *
 * Translates a pending application transaction into the on-chain facts the
 * verification service must independently confirm on Hive.
 *
 * Authoritative sources ONLY:
 *   - CREATE_COLLECTION amount = maxSupply x NFT_CREATION_COST_PER_MINT (0.1 HIVE)
 *     with maxSupply read from the persisted collection document whenever one
 *     exists, falling back to the request payload for the no-draft path.
 *   - MINT_NFT amount = the collection's own mintPrice from MongoDB.
 *
 * A client-supplied `amount` is NEVER used to build an expectation.
 *
 * SERVER-ONLY.
 */
import { collectionCreationCost, splitSalePayment } from "@/lib/config/config";
import { toHiveAmount } from "@/lib/chain/amounts";
import { HIVE_CURRENCY, MARKET_ACCOUNT, PLATFORM_ACCOUNT } from "@/lib/constants";
import { nftCollectionsRepository } from "@/lib/modules/collections/repository.server";
import { nftsRepository } from "@/lib/modules/nfts/repository.server";
import type { NftDocument } from "@/lib/modules/nfts/types.server";
import type { PendingTransaction } from "@/lib/modules/transactions-pending/types.server";
import { TerminalTransactionError } from "../lib/errors";
import type { TransactionExpectation } from "./verification.service";

/** The NFT this request targets — the application's own record, not the client's. */
async function requireNft(tx: PendingTransaction, nftId?: string): Promise<NftDocument> {
  const id = nftId ?? tx.nftId;
  if (!id) throw new TerminalTransactionError("Request has no NFT", "VALIDATION_FAILED");
  const nft = await nftsRepository.findById(id);
  if (!nft) throw new TerminalTransactionError(`NFT not found: ${id}`, "NOT_FOUND");
  return nft;
}

/**
 * The listed NFT this request targets. A listing is the cached Hive market
 * state on the NFT document — its id IS the NFT id.
 */
async function requireListing(
  tx: PendingTransaction,
): Promise<{ seller: string; price: number; nft: NftDocument }> {
  const payload = tx.payload as { listingId?: string; nftId?: string };
  const id = payload.listingId ?? tx.listingId ?? payload.nftId ?? tx.nftId;
  if (!id) throw new TerminalTransactionError("Request has no listing", "VALIDATION_FAILED");
  const nft = await nftsRepository.findById(id);
  if (!nft) throw new TerminalTransactionError(`Listing not found: ${id}`, "NOT_FOUND");
  if (!nft.isListed || !nft.listingSeller || !nft.listingPrice)
    throw new TerminalTransactionError("Listing is not active", "VALIDATION_FAILED");
  return { seller: nft.listingSeller, price: nft.listingPrice, nft };
}

/** Authoritative supply for a CREATE_COLLECTION request. */
async function creationSupply(tx: PendingTransaction): Promise<number> {
  const payload = tx.payload as { collectionId?: string; maxSupply?: number };
  const collectionId = payload.collectionId ?? tx.collectionId;
  if (collectionId) {
    const doc = await nftCollectionsRepository.findById(collectionId);
    if (doc) return doc.maxSupply;
  }
  const supply = Number(payload.maxSupply ?? 0);
  if (!Number.isInteger(supply) || supply <= 0) {
    throw new TerminalTransactionError(
      `Invalid collection supply: ${String(payload.maxSupply)}`,
      "VALIDATION_FAILED",
    );
  }
  return supply;
}

/** Authoritative mint price for a MINT_NFT request. */
async function mintPrice(tx: PendingTransaction): Promise<number> {
  const payload = tx.payload as { collectionId?: string };
  const collectionId = payload.collectionId ?? tx.collectionId;
  if (!collectionId) {
    throw new TerminalTransactionError("Mint request has no collection", "VALIDATION_FAILED");
  }
  const collection = await nftCollectionsRepository.findById(collectionId);
  if (!collection) {
    throw new TerminalTransactionError(`Collection not found: ${collectionId}`, "NOT_FOUND");
  }
  return toHiveAmount(collection.mintPrice);
}

/**
 * Builds the expectation for a pending transaction.
 * Returns null when the transaction type carries no verifiable payment yet.
 */
export async function buildExpectation(
  tx: PendingTransaction,
): Promise<TransactionExpectation | null> {
  const hiveTransactionId = tx.hiveTransactionId ?? "";

  switch (tx.type) {
    case "CREATE_COLLECTION": {
      return {
        hiveTransactionId,
        operationType: "transfer",
        sender: tx.hiveAccount,
        recipient: PLATFORM_ACCOUNT,
        amount: collectionCreationCost(await creationSupply(tx)),
        symbol: HIVE_CURRENCY,
        // Business rule: the exact fee, to the milli. 0.099 HIVE is not 0.1 HIVE.
        amountTolerance: 0,
      };
    }
    case "MINT_NFT": {
      return {
        hiveTransactionId,
        operationType: "transfer",
        sender: tx.hiveAccount,
        recipient: PLATFORM_ACCOUNT,
        amount: await mintPrice(tx),
        symbol: HIVE_CURRENCY,
        amountTolerance: 0,
      };
    }
    /**
     * Marketplace operations are user-signed custom_json operations. Only the
     * signer is verifiable generically; the token identity is asserted through
     * the memo/json payload, and every application-state rule (ownership,
     * listing state) is re-checked against MongoDB by the worker handler.
     */
    case "TRANSFER_NFT": {
      const nft = await requireNft(tx, (tx.payload as { nftId?: string }).nftId ?? tx.nftId);
      return {
        hiveTransactionId,
        operationType: "custom_json",
        // Authoritative: the CURRENT owner, never the client-declared sender.
        sender: nft.owner,
        memoIncludes: String(nft.tokenId),
      };
    }
    case "LIST_NFT": {
      const nft = await requireNft(tx, (tx.payload as { nftId?: string }).nftId ?? tx.nftId);
      return {
        hiveTransactionId,
        operationType: "custom_json",
        sender: nft.owner,
        memoIncludes: String(nft.tokenId),
      };
    }
    case "CANCEL_LISTING": {
      const listing = await requireListing(tx);
      return {
        hiveTransactionId,
        operationType: "custom_json",
        // Only the seller of record can cancel.
        sender: listing.seller,
      };
    }
    case "BUY_NFT": {
      const listing = await requireListing(tx);
      // Authoritative price: the indexed listing, never the client payload.
      const { total } = splitSalePayment(listing.price);
      return {
        hiveTransactionId,
        operationType: "transfer",
        sender: tx.hiveAccount,
        recipient: MARKET_ACCOUNT,
        amount: toHiveAmount(total),
        symbol: HIVE_CURRENCY,
        amountTolerance: 0,
      };
    }
    default:
      throw new TerminalTransactionError(
        `Unsupported transaction type: ${String(tx.type)}`,
        "UNSUPPORTED_TRANSACTION_TYPE",
      );
  }
}
