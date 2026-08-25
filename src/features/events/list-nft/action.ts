import { MARKET_ACCOUNT } from "@/features/types/constants";
import type { ListNftInput, ListNftResult } from "@/features/types/marketplace";
import { newId } from "@/features/mocks/data/activity/model";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { buildListing } from "@/features/mocks/data/marketplace/model";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { hiveService } from "@/features/mocks/services";

/** Puts an owned NFT on the marketplace. */
export async function listNft({ nftId, price }: ListNftInput): Promise<ListNftResult> {
  const nft = nftsRepository.findById(nftId);
  if (!nft) throw new Error("NFT not found");

  const tx = await hiveService.transfer(nft.owner, MARKET_ACCOUNT, 0, `List · ${nft.name}`);
  const listing = buildListing({ id: newId("lst"), nftId, seller: nft.owner, price });

  marketplaceRepository.insert(listing);
  nftsRepository.update(nftId, { status: "Listed" });

  activityRepository.addTransaction({
    txId: tx.txId,
    type: "list",
    from: nft.owner,
    to: MARKET_ACCOUNT,
    amount: price,
    memo: `Listing created · ${nft.name}`,
  });
  activityRepository.add({
    type: "Listed",
    actor: nft.owner,
    nftId,
    collectionId: nft.collectionId,
    label: `@${nft.owner} listed ${nft.name}`,
    amount: price,
    txId: tx.txId,
  });

  return listing;
}
