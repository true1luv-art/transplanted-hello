import type { TransferNftInput } from "@/features/types/nft";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { marketplaceRepository } from "@/features/mocks/data/marketplace/repository";
import { nftsRepository } from "@/features/mocks/data/nfts/repository";
import { hiveService } from "@/features/mocks/services";

/** Sends an owned NFT to another Hive account. */
export async function transferNft({ nftId, to }: TransferNftInput): Promise<void> {
  const nft = nftsRepository.findById(nftId);
  if (!nft) throw new Error("NFT not found");

  const tx = await hiveService.issueNft(nft.collectionName, to, nft.tokenId ?? undefined);

  nftsRepository.update(nftId, { owner: to, status: "Owned" });
  marketplaceRepository.removeByNft(nftId);

  activityRepository.addTransaction({
    txId: tx.txId,
    type: "transfer",
    from: nft.owner,
    to,
    amount: 0,
    memo: `Transfer · ${nft.name}`,
  });
  activityRepository.add({
    type: "Transferred",
    actor: nft.owner,
    target: to,
    nftId,
    collectionId: nft.collectionId,
    label: `@${nft.owner} transferred ${nft.name} to @${to}`,
    txId: tx.txId,
  });
}
