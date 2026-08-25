import { PLATFORM_ACCOUNT, RANK_POOL_CAP } from "@/lib/constants";
import type { MintNftInput, MintNftResult } from "@/features/types/nft";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { isSoldOut } from "@/features/mocks/data/collections/model";
import { collectionsRepository } from "@/features/mocks/data/collections/repository";
import { creatorShare, quoteMint } from "@/features/mocks/data/marketplace/model";
import { buildNFT } from "@/features/mocks/data/nfts/model";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import type { NFT } from "@/features/types/domain/nfts";
import type { NftAsset } from "@/features/types/domain/nft-assets";
import type { Collection } from "@/features/types/domain/collections";
import { nftAssetsRepository } from "@/features/mocks/data/nft-assets/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { databaseService, hiveService, marketplaceService, mockHiveService } from "@/features/mocks/services";

/**
 * Next CHRONOLOGICAL mint number inside a collection. It counts mints of that
 * collection only — it is not a blockchain token id and not a file number.
 */
function nextNFTMintedNumber(collectionId: string): number {
  const numbers = nftsRepository
    .list()
    .filter((n) => n.collectionId === collectionId)
    .map((n) => n.NFTMintedNumber ?? 0);
  return Math.max(0, ...numbers) + 1;
}

/** Highest blockchain token id this client has indexed so far. */
function highestKnownTokenId(): number {
  return Math.max(0, ...nftsRepository.list().map((n) => n.tokenId ?? 0));
}

/**
 * Mint queue. Concurrent mint requests are serialised so two users minting at
 * the same time receive distinct, ordered mint numbers: whoever's transaction
 * is processed first gets the lower `NFTMintedNumber`.
 */
let mintQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = mintQueue.then(task, task);
  mintQueue = run.catch(() => undefined);
  return run;
}

/** Turns a prepared, unminted asset into a fully minted NFT record. */
function assetToNft(
  asset: NftAsset,
  collection: Collection,
  owner: string,
  NFTMintedNumber: number,
  tokenId: number,
  txId: string,
): NFT {
  return {
    id: asset.id,
    collectionId: collection.id,
    collectionName: collection.name,
    tokenId,
    name: asset.name,
    description: asset.description,
    image: asset.imageUri ?? collection.image,
    traits: (asset.attributes ?? []).map((attribute) => ({
      layerId: attribute.trait_type,
      layerName: attribute.trait_type,
      traitValueId: `${attribute.trait_type}:${attribute.value}`,
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
    attributes: asset.attributes ?? [],
    imageCid: asset.imageCid,
    metadataCid: asset.metadataCid,
    imageRootCid: asset.imageRootCid,
    metadataRootCid: asset.metadataRootCid,
    metadataUri: asset.metadataUri ?? "",
    estimatedValue: collection.mintPrice,
    createdAt: new Date().toISOString(),
    status: "Owned",
    NFTMintedNumber,
    properties: asset.properties,
    transaction: { txId, type: "NFT_MINT", status: "confirmed" },
  };
}

/**
 * Picks the next unminted asset for a collection: a prepared record from the
 * `nftAssets` inventory when one exists, otherwise a freshly generated token.
 *
 * Nothing here assigns a blockchain id — that only happens inside `mintNft`
 * once the mock chain confirms the issue transaction.
 */
export function drawUnmintedAsset(collectionId: string): NftAsset | undefined {
  const available = nftAssetsRepository
    .listByCollection(collectionId)
    .filter((asset) => asset.NFTMintedNumber === null && asset.status !== "minted");
  if (!available.length) return undefined;
  return available[Math.floor(Math.random() * available.length)];
}

/** Mints one NFT from a collection for the connected user (queued). */
export function mintNft(input: MintNftInput): Promise<MintNftResult> {
  return enqueue(() => processMint(input));
}

async function processMint({ collectionId }: MintNftInput): Promise<MintNftResult> {
  const collection = collectionsRepository.findById(collectionId);
  if (!collection) throw new Error("Collection not found");

  const buyer = usersRepository.currentUsername();
  const quote = quoteMint(collection);
  if (!usersRepository.canAfford(buyer, quote.total)) throw new Error("Insufficient HIVE balance");

  if (isSoldOut(collection)) throw new Error("Collection is sold out");

  const tx = await hiveService.transfer(
    buyer,
    PLATFORM_ACCOUNT,
    quote.total,
    `Mint · ${collection.name}`,
  );

  // Mint order inside this collection — assigned once the payment cleared.
  const NFTMintedNumber = nextNFTMintedNumber(collectionId);
  // The chain owns token ids; make sure the mock chain knows what we indexed.
  mockHiveService.syncTokenCounter(highestKnownTokenId());
  const asset = drawUnmintedAsset(collectionId);
  let nft: NFT;

  if (asset) {
    // The blockchain assigns the token id — we read it back from the issue op.
    const issue = await hiveService.issueNft(collection.symbol, buyer);
    nft = assetToNft(asset, collection, buyer, NFTMintedNumber, issue.tokenId, tx.txId);
    // The asset row is preserved and marked consumed — never deleted.
    nftAssetsRepository.patch(asset.id, {
      status: "minted",
      NFTMintedNumber,
      NFTokenID: issue.tokenId,
    });
  } else {
    const mintNumber = await databaseService.nextMintedNumber(collection);
    const token = await marketplaceService.generateToken(collection, mintNumber);
    const issue = await hiveService.issueNft(collection.symbol, buyer);
    nft = {
      ...buildNFT({
        collection,
        mintNumber,
        owner: buyer,
        token,
        rankTotal: Math.max(1, Math.min(collection.maxSupply, RANK_POOL_CAP)),
        createdAt: new Date().toISOString(),
        seedKey: `${collection.id}-${mintNumber}-${Date.now()}`,
        NFTMintedNumber,
        tokenId: issue.tokenId,
      }),
      transaction: { txId: tx.txId, type: "NFT_MINT", status: "confirmed" },
    };
  }

  await databaseService.saveNft(nft);

  nftsRepository.insert(nft);
  collectionsRepository.recordMint(collectionId, quote.total);

  usersRepository.adjustBalance(buyer, -quote.total);
  usersRepository.adjustBalance(collection.creator, creatorShare(collection, quote.mintPrice));

  activityRepository.addTransaction({
    txId: tx.txId,
    type: "mint",
    from: buyer,
    to: PLATFORM_ACCOUNT,
    amount: quote.total,
    memo: `Mint · ${collection.name} · ${nft.name}`,
  });
  activityRepository.add({
    type: "Minted",
    actor: buyer,
    nftId: nft.id,
    collectionId,
    label: `@${buyer} minted ${nft.name}`,
    amount: quote.mintPrice,
    txId: tx.txId,
  });

  return { nft, txId: tx.txId };
}
