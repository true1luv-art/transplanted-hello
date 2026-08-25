/**
 * Event action: mint an NFT asset on the REAL Hive blockchain.
 *
 * The action is a thin boundary — all orchestration lives in the mint service,
 * all chain work in `lib/chain/hive.ts` + `lib/chain/keychain.ts`.
 */
import {
  MintError,
  mintNftAsset,
  nextMintableAsset,
  recoverPendingMints,
  type MintNftAssetInput,
  type MintNftAssetResult,
} from "@/features/lib/mint/hive-mint.service";

export type { MintNftAssetResult };
export { MintError, nextMintableAsset, recoverPendingMints };

/** Mint queue: concurrent requests are serialised so mint order is stable. */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function mintNftOnChain(input: MintNftAssetInput): Promise<MintNftAssetResult> {
  return enqueue(() => mintNftAsset(input));
}
