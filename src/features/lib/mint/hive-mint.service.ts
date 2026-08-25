/**
 * NFT Mint Service — the ONLY place that orchestrates a real Hive mint.
 *
 *   React UI -> Zustand action -> NFT Mint Service -> lib/chain/hive.ts -> dhive
 *                                                  -> lib/chain/keychain.ts -> Keychain
 *
 * It never builds raw Hive operations itself (that is `hive.ts`), never talks
 * to the extension directly (that is `keychain.ts`) and never renders anything.
 */
import { getAccountHiveBalance } from "@/lib/chain/hive";
import { issueNftOnHive, readNftIssuance } from "@/lib/chain/issue-nft.functions";
import { buildNftProperties } from "@/lib/chain/nft-properties";
import { resolveIpfsUrl } from "@/features/lib/storage/ipfs-uri";
import { acquireMintLock, releaseMintLock } from "@/features/lib/mint/mint-lock";
import { collectionsRepository } from "@/features/mocks/data/collections/repository";
import { nftAssetsRepository } from "@/features/mocks/data/nft-assets/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { mintTransactionsRepository } from "@/features/mocks/data/mint-transactions/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import type { Collection } from "@/features/types/domain/collections";
import type { NftAsset } from "@/features/types/domain/nft-assets";
import type { NFT, NFTAttribute } from "@/features/types/domain/nfts";
import type { MintProgress, MintTransactionRecord } from "@/features/types/domain/mint";

export class MintError extends Error {
  constructor(
    readonly code:
      | "ASSET_NOT_FOUND"
      | "ASSET_UNAVAILABLE"
      | "ALREADY_MINTED"
      | "ALREADY_MINTING"
      | "COLLECTION_NOT_FOUND"
      | "NO_SYMBOL"
      | "NO_ACCOUNT"
      | "METADATA_UNAVAILABLE"
      | "INVALID_METADATA"
      | "INSUFFICIENT_BALANCE"
      | "ISSUER_NOT_CONFIGURED"
      | "REJECTED"
      | "BROADCAST_FAILED"
      | "CHAIN_ERROR"
      | "TOKEN_ID_UNAVAILABLE",
    message: string,
  ) {
    super(message);
    this.name = "MintError";
  }
}

/** NFT metadata as published to IPFS by the generator. */
export interface IpfsNftMetadata {
  name: string;
  description: string;
  image: string;
  attributes: NFTAttribute[];
}

export interface MintNftAssetInput {
  assetId?: string;
  collectionId: string;
  /** Hive account minting and signing. Defaults to the session user. */
  account?: string;
  onProgress?: (progress: MintProgress) => void;
}

export interface MintNftAssetResult {
  nft: NFT;
  txId: string;
  tokenId: number;
  record: MintTransactionRecord;
}

const report = (input: MintNftAssetInput, stage: MintProgress["stage"], message: string) =>
  input.onProgress?.({ stage, message });

/** Reads an NFT's metadata document from IPFS through a PUBLIC gateway. */
export async function loadNftMetadata(metadataUri: string): Promise<IpfsNftMetadata> {
  const url = resolveIpfsUrl(metadataUri);
  if (!url) throw new MintError("METADATA_UNAVAILABLE", "NFT metadata is not on IPFS yet");
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new MintError("METADATA_UNAVAILABLE", "IPFS gateway is unreachable");
  }
  if (!response.ok) {
    throw new MintError("METADATA_UNAVAILABLE", `IPFS metadata unavailable (${response.status})`);
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new MintError("INVALID_METADATA", "IPFS metadata is not valid JSON");
  }
  const meta = parsed as Partial<IpfsNftMetadata> | null;
  if (!meta || typeof meta !== "object" || typeof meta.name !== "string" || !meta.name) {
    throw new MintError("INVALID_METADATA", "IPFS metadata is missing a name");
  }
  return {
    name: meta.name,
    description: typeof meta.description === "string" ? meta.description : "",
    image: typeof meta.image === "string" ? meta.image : "",
    attributes: Array.isArray(meta.attributes) ? meta.attributes : [],
  };
}

/** An asset can only be minted when it is unminted, unlocked and uploaded. */
export function isMintable(asset: NftAsset): boolean {
  return (
    asset.status !== "minted" &&
    asset.NftMintedNumber === null &&
    asset.NFTokenID === null &&
    !mintTransactionsRepository.activeForAsset(asset.id)
  );
}

/** Picks the next mintable asset of a collection (lowest file number first). */
export function nextMintableAsset(collectionId: string): NftAsset | undefined {
  return nftAssetsRepository.listByCollection(collectionId).find(isMintable);
}

function nextMintedNumber(collectionId: string): number {
  const numbers = nftsRepository
    .list()
    .filter((nft) => nft.collectionId === collectionId)
    .map((nft) => nft.NftMintedNumber ?? 0);
  return Math.max(0, ...numbers) + 1;
}

function toMintedNft(params: {
  asset: NftAsset;
  collection: Collection;
  metadata: IpfsNftMetadata;
  owner: string;
  tokenId: number;
  NftMintedNumber: number;
  txId: string;
  properties: NftAsset["properties"];
}): NFT {
  const { asset, collection, metadata, owner, tokenId, NftMintedNumber, txId, properties } = params;
  return {
    id: asset.id,
    collectionId: collection.id,
    collectionName: collection.name,
    tokenId,
    NftMintedNumber,
    properties,
    name: metadata.name || asset.name,
    description: metadata.description || asset.description,
    image: asset.imageUri ?? metadata.image ?? collection.image,
    traits: (asset.attributes ?? []).map((attribute) => ({
      layerId: attribute.trait,
      layerName: attribute.trait,
      traitValueId: `${attribute.trait}:${attribute.value}`,
      traitValueName: String(attribute.value),
      weight: 0,
      probability: 0,
    })),
    rarityScore: asset.rarityScore ?? 0,
    rarityRank: asset.rarityRank ?? 0,
    rarityRankTotal: asset.rarityRankTotal ?? collection.maxSupply,
    mintNumber: asset.NFTMintId,
    maxSupply: collection.maxSupply,
    owner,
    attributes: metadata.attributes.length ? metadata.attributes : (asset.attributes ?? []),
    imageCid: asset.imageCid,
    metadataCid: asset.metadataCid,
    imageRootCid: asset.imageRootCid,
    metadataRootCid: asset.metadataRootCid,
    metadataUri: asset.metadataUri ?? "",
    estimatedValue: collection.mintPrice,
    createdAt: new Date().toISOString(),
    status: "Owned",
    mock: false,
    transaction: { txId, type: "NFT_MINT", status: "confirmed" },
  };
}

/**
 * Persists a confirmed issuance: asset -> nfts, journal -> confirmed.
 * Idempotent — re-running it for an already indexed token is a no-op.
 */
function commitMint(params: {
  asset: NftAsset;
  collection: Collection;
  metadata: IpfsNftMetadata;
  owner: string;
  tokenId: number;
  txId: string;
  record: MintTransactionRecord;
  /** Chain-facing properties actually written on Hive (platform symbol). */
  properties?: NftAsset["properties"];
}): NFT {
  const { asset, collection, metadata, owner, tokenId, txId, record } = params;
  const existing = nftsRepository.list().find((nft) => nft.id === asset.id);
  if (existing) return existing;

  const NftMintedNumber = nextMintedNumber(collection.id);
  const properties =
    params.properties ??
    buildNftProperties({
      collection: collection.name,
      symbol: record.symbol || collection.symbol,
      metadata,
    });
  const nft = toMintedNft({
    asset,
    collection,
    metadata,
    owner,
    tokenId,
    NftMintedNumber,
    txId,
    properties,
  });

  nftsRepository.insert(nft);
  // The asset row is preserved and marked consumed — never deleted.
  nftAssetsRepository.patch(asset.id, {
    status: "minted",
    NftMintedNumber,
    NFTokenID: tokenId,
    properties,
  });
  collectionsRepository.recordMint(collection.id, 0);
  mintTransactionsRepository.patch(record.id, {
    status: "confirmed",
    txId,
    NFTokenID: tokenId,
  });
  activityRepository.addTransaction({
    txId,
    type: "mint",
    from: owner,
    to: owner,
    amount: 0,
    memo: `Hive mint · ${collection.name} · ${nft.name}`,
  });
  activityRepository.add({
    type: "Minted",
    actor: owner,
    nftId: nft.id,
    collectionId: collection.id,
    label: `@${owner} minted ${nft.name} on Hive`,
    txId,
  });
  return nft;
}

/**
 * Mints ONE NFT asset on the real Hive blockchain, signed by the user through
 * Hive Keychain. On any failure the asset stays unminted and retryable.
 */
export async function mintNftAsset(input: MintNftAssetInput): Promise<MintNftAssetResult> {
  report(input, "preparing", "Preparing mint…");

  const collection = collectionsRepository.findById(input.collectionId);
  if (!collection) throw new MintError("COLLECTION_NOT_FOUND", "Collection not found");
  const symbol = (collection.symbol ?? "").trim().toUpperCase();
  if (!symbol) {
    throw new MintError("NO_SYMBOL", "This collection has no Hive NFT symbol — launch it first");
  }

  const account = (input.account ?? usersRepository.currentUsername() ?? "").trim().toLowerCase();
  if (!account) throw new MintError("NO_ACCOUNT", "Connect a Hive account before minting");

  const asset = input.assetId
    ? nftAssetsRepository.findById(input.assetId)
    : nextMintableAsset(collection.id);
  if (!asset) throw new MintError("ASSET_NOT_FOUND", "No unminted NFT available in this collection");
  if (asset.status === "minted" || asset.NFTokenID !== null) {
    throw new MintError("ALREADY_MINTED", "This NFT has already been minted");
  }
  if (mintTransactionsRepository.activeForAsset(asset.id)) {
    throw new MintError("ALREADY_MINTING", "A mint for this NFT is already in progress");
  }
  if (!acquireMintLock(asset.id)) {
    throw new MintError("ALREADY_MINTING", "This NFT is being minted in another tab");
  }

  const record = mintTransactionsRepository.create({
    assetId: asset.id,
    collectionId: collection.id,
    account,
    symbol,
  });

  const fail = (code: ConstructorParameters<typeof MintError>[0], message: string): MintError => {
    mintTransactionsRepository.patch(record.id, {
      status: code === "REJECTED" ? "rejected" : "failed",
      error: message,
    });
    releaseMintLock(asset.id);
    report(input, "failed", message);
    return new MintError(code, message);
  };

  try {
    // 1. Metadata always comes from IPFS — minting never re-creates or re-uploads it.
    report(input, "metadata", "Reading NFT metadata from IPFS…");
    if (!asset.metadataUri) {
      throw fail("METADATA_UNAVAILABLE", "This NFT has no IPFS metadata reference yet");
    }
    let metadata: IpfsNftMetadata;
    try {
      metadata = await loadNftMetadata(asset.metadataUri);
    } catch (error) {
      throw error instanceof MintError
        ? fail(error.code, error.message)
        : fail("METADATA_UNAVAILABLE", "IPFS metadata could not be read");
    }

    // 2. The chain is authoritative for the balance.
    try {
      const balance = await getAccountHiveBalance(account);
      if (balance <= 0) {
        throw fail("INSUFFICIENT_BALANCE", `@${account} has no liquid HIVE to cover the mint fee`);
      }
    } catch (error) {
      if (error instanceof MintError) throw error;
      // RPC unreachable for the balance check must not block the signature.
    }

    // 3. Chain-facing metadata: the IPFS URI ONLY. Hive Engine caps every NFT
    //    property at 100 characters, so the document itself never goes on chain.
    const metadataUri = asset.metadataUri;

    // 4. The ISSUER account signs and broadcasts the real Hive transaction.
    //    The private key stays on the server — the browser only sends data.
    report(input, "signing", "Issuing the NFT on Hive…");
    mintTransactionsRepository.patch(record.id, { status: "signing" });
    let issued: Awaited<ReturnType<typeof issueNftOnHive>>;
    try {
      issued = await issueNftOnHive({
        data: { collection: collection.name, metadata: metadataString, to: account },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hive issuance failed";
      throw fail(
        /issuer is not configured/i.test(message) ? "ISSUER_NOT_CONFIGURED" : "BROADCAST_FAILED",
        message,
      );
    }
    if (issued.error) throw fail("CHAIN_ERROR", issued.error);

    const txId = issued.txId;
    // The chain symbol is the ONE platform collection (e.g. TESTNFTS); the
    // application collection lives in the `collection` property.
    const properties = buildNftProperties({
      collection: collection.name,
      symbol: issued.symbol,
      metadata,
    });
    mintTransactionsRepository.patch(record.id, {
      status: "broadcasted",
      txId,
      symbol: issued.symbol,
    });
    report(input, "broadcasted", "Broadcast to Hive — waiting for confirmation…");

    // 5. Only the chain can tell us the REAL token id.
    report(input, "confirming", "Reading the NFT id from Hive…");
    if (issued.tokenId === null) {
      releaseMintLock(asset.id);
      report(input, "failed", "Mint broadcast, token id not available yet");
      throw new MintError(
        "TOKEN_ID_UNAVAILABLE",
        "Transaction broadcast, but Hive has not exposed the NFT id yet. It will be recovered automatically.",
      );
    }

    const nft = commitMint({
      asset,
      collection,
      metadata,
      owner: account,
      tokenId: issued.tokenId,
      txId,
      properties,
      record,
    });
    releaseMintLock(asset.id);
    report(input, "confirmed", "NFT minted on Hive");
    return {
      nft,
      txId,
      tokenId: issued.tokenId,
      record: mintTransactionsRepository.findById(record.id) ?? record,
    };
  } catch (error) {
    releaseMintLock(asset.id);
    if (error instanceof MintError) throw error;
    const message = error instanceof Error ? error.message : "Mint failed";
    mintTransactionsRepository.patch(record.id, { status: "failed", error: message });
    report(input, "failed", message);
    throw new MintError("BROADCAST_FAILED", message);
  }
}

/**
 * Recovery path: re-queries Hive for broadcasted mints whose token id was not
 * available yet, so no NFT can stay stuck in `minting`.
 */
export async function recoverPendingMints(): Promise<number> {
  let recovered = 0;
  for (const record of mintTransactionsRepository.listRecoverable()) {
    const asset = nftAssetsRepository.findById(record.assetId);
    const collection = collectionsRepository.findById(record.collectionId);
    if (!asset || !collection || !record.txId) continue;
    const outcome = await readNftIssuance({ data: { txId: record.txId, to: record.account } });
    if (outcome.error) {
      mintTransactionsRepository.patch(record.id, { status: "failed", error: outcome.error });
      releaseMintLock(asset.id);
      continue;
    }
    if (outcome.tokenId === null) continue;
    let metadata: IpfsNftMetadata;
    try {
      metadata = await loadNftMetadata(asset.metadataUri ?? "");
    } catch {
      metadata = {
        name: asset.name,
        description: asset.description,
        image: asset.imageUri ?? "",
        attributes: asset.attributes ?? [],
      };
    }
    commitMint({
      asset,
      collection,
      metadata,
      owner: record.account,
      tokenId: outcome.tokenId,
      txId: record.txId,
      record,
    });
    releaseMintLock(asset.id);
    recovered += 1;
  }
  return recovered;
}
