import { transactionsPendingRepository } from "@/lib/modules/transactions-pending/repository.server";
import { transactionsProcessedRepository } from "@/lib/modules/transactions-processed/repository.server";
import { getWorker } from "@/server/smart-contract";
import type {
  CreatePendingTransactionInput,
  TransactionType,
} from "@/lib/modules/transactions-pending/types.server";

export interface MutationResult {
  transactionId: string;
  requestId: string;
  type: TransactionType;
  status: string;
  duplicate: boolean;
  receipt: {
    status: string;
    hiveTransactionId: string;
    blockNumber: number | undefined;
    collectionId: string | undefined;
    nftId: string | undefined;
    result: Record<string, unknown>;
    error: string | undefined;
  } | null;
}

/**
 * Enqueues a pending transaction, drains the worker so the result is
 * available synchronously, then returns the final status. Idempotent on
 * `requestId` — a retried call returns the original receipt.
 */
export async function enqueueAndProcess<T extends TransactionType>(
  input: Omit<CreatePendingTransactionInput<T>, "userId" | "hiveAccount">,
  actor: { userId: string; hiveAccount: string },
): Promise<MutationResult> {
  const full = {
    ...input,
    userId: actor.userId,
    hiveAccount: actor.hiveAccount,
  } as CreatePendingTransactionInput<T>;

  const { transaction, duplicate } = await transactionsPendingRepository.enqueue(full);

  // Process inline so the caller gets a confirmed result in one round-trip.
  // The worker is idempotent (receipt guard), so draining extra is safe.
  await getWorker().drain(5);

  const receipt = await transactionsProcessedRepository.findByTransactionId(
    transaction.transactionId,
  );
  const pending = await transactionsPendingRepository.findById(transaction.id);

  return {
    transactionId: transaction.transactionId,
    requestId: transaction.requestId,
    type: transaction.type,
    status: receipt?.status ?? pending?.status ?? "pending",
    duplicate,
    receipt: receipt
      ? {
          status: receipt.status,
          hiveTransactionId: receipt.hiveTransactionId,
          blockNumber: receipt.blockNumber,
          collectionId: receipt.collectionId,
          nftId: receipt.nftId,
          result: receipt.result,
          error: receipt.error,
        }
      : null,
  };
}
