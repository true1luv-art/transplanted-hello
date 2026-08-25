import { COLLECTION_CREATION_FEE, PLATFORM_ACCOUNT } from "@/features/types/constants";
import type { CreateCollectionInput, CreateCollectionResult } from "@/features/types/collection";
import { newId } from "@/features/mocks/data/activity/model";
import { activityRepository } from "@/features/mocks/data/activity/repository";
import { buildCollection } from "@/features/mocks/data/collections/model";
import { collectionsRepository } from "@/features/mocks/data/collections/repository";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { databaseService, hiveService } from "@/features/mocks/services";

/**
 * Deploys a new collection: charges the deployment fee, records the chain
 * transaction and stores the collection (plus any imported unminted tokens).
 */
export async function createCollection(
  input: CreateCollectionInput,
): Promise<CreateCollectionResult> {
  const creator = usersRepository.currentUsername();
  const collectionId = newId("col");
  const collection = buildCollection(input, creator, collectionId);

  const fee = input.creationCost ?? COLLECTION_CREATION_FEE;
  if (!usersRepository.canAfford(creator, fee)) {
    throw new Error(`Insufficient HIVE balance — deployment costs ${fee.toFixed(2)} HIVE`);
  }

  const tx = await hiveService.transfer(
    creator,
    PLATFORM_ACCOUNT,
    fee,
    `Collection deployment · ${collection.name}`,
  );
  await databaseService.saveCollection(collection);

  collectionsRepository.insert(collection);
  if (input.importedNfts?.length) {
    collectionsRepository.setUnminted(
      collectionId,
      input.importedNfts.map((nft) => ({ ...nft, collectionId })),
    );
  }

  usersRepository.adjustBalance(creator, -fee);
  activityRepository.addTransaction({
    txId: tx.txId,
    type: "collection_create",
    from: creator,
    to: PLATFORM_ACCOUNT,
    amount: fee,
    memo: `Collection deployment · ${collection.name}`,
  });
  activityRepository.add({
    type: "Collection Created",
    actor: creator,
    collectionId: collection.id,
    label: `@${creator} created ${collection.name}`,
    amount: fee,
    txId: tx.txId,
  });

  return collection;
}
