import { appData } from "@/features/lib/data/app-data";
import type { MintTransactionRecord, MintTransactionStatus } from "@/features/types/domain/mint";

const now = () => new Date().toISOString();

/**
 * Data access for the local mint journal — the only module allowed to
 * read/write the `mintTransactions` collection of the local database.
 */
export const mintTransactionsRepository = {
  list(): MintTransactionRecord[] {
    return appData.read().mintTransactions ?? [];
  },

  findById(id: string): MintTransactionRecord | undefined {
    return this.list().find((record) => record.id === id);
  },

  listByAsset(assetId: string): MintTransactionRecord[] {
    return this.list().filter((record) => record.assetId === assetId);
  },

  /** Records that still hold a lock on their asset. */
  listActive(): MintTransactionRecord[] {
    return this.list().filter(
      (record) =>
        record.status === "pending" ||
        record.status === "signing" ||
        record.status === "broadcasted",
    );
  },

  activeForAsset(assetId: string): MintTransactionRecord | undefined {
    return this.listActive().find((record) => record.assetId === assetId);
  },

  /** Broadcasted mints whose real token id could not be read yet. */
  listRecoverable(): MintTransactionRecord[] {
    return this.list().filter(
      (record) => record.status === "broadcasted" && Boolean(record.txId) && !record.NFTokenID,
    );
  },

  create(
    input: Omit<MintTransactionRecord, "id" | "createdAt" | "updatedAt" | "type" | "status"> & {
      status?: MintTransactionStatus;
    },
  ): MintTransactionRecord {
    const record: MintTransactionRecord = {
      id: `mint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "NFT_MINT",
      status: input.status ?? "pending",
      assetId: input.assetId,
      collectionId: input.collectionId,
      account: input.account,
      symbol: input.symbol,
      txId: input.txId,
      NFTokenID: input.NFTokenID ?? null,
      error: input.error,
      createdAt: now(),
      updatedAt: now(),
    };
    appData.update((state) => ({
      mintTransactions: [record, ...(state.mintTransactions ?? [])],
    }));
    return record;
  },

  patch(id: string, patch: Partial<MintTransactionRecord>): MintTransactionRecord | undefined {
    appData.update((state) => ({
      mintTransactions: (state.mintTransactions ?? []).map((record) =>
        record.id === id ? { ...record, ...patch, updatedAt: now() } : record,
      ),
    }));
    return this.findById(id);
  },
};
