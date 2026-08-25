export type ActivityType =
  "Minted" | "Listed" | "Sold" | "Transferred" | "Collection Created" | "Delisted";

export interface Activity {
  id: string;
  type: ActivityType;
  actor: string;
  target?: string;
  nftId?: string;
  collectionId?: string;
  label: string;
  amount?: number;
  txId?: string;
  createdAt: string;
}

export type TransactionType =
  "mint" | "list" | "sale" | "transfer" | "collection_create" | "cancel";

/** Ledger entry mirroring a (mocked) Hive chain transaction. */
export interface Transaction {
  id: string;
  txId: string;
  type: TransactionType;
  from: string;
  to: string;
  amount: number;
  memo: string;
  createdAt: string;
}

export type NewActivity = Omit<Activity, "id" | "createdAt"> & { createdAt?: string };
export type NewTransaction = Omit<Transaction, "id" | "createdAt"> & { createdAt?: string };
