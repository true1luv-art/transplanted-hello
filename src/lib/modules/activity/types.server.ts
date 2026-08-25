/**
 * MongoDB document types for the `activity` collection.
 *
 * Hive identity rule: `actor` and `target` are Hive account names, which are
 * themselves the blockchain identities (no separate wallet address exists).
 */
export type ActivityDocumentType =
  "Minted" | "Listed" | "Sold" | "Transferred" | "Collection Created" | "Delisted";

export interface ActivityDocument {
  id: string;
  type: ActivityDocumentType;
  /** Hive account name of the acting account, e.g. "rhiaji". */
  actor: string;
  /** Hive account name of the counterparty account, when there is one. */
  target?: string | undefined;
  nftId?: string | undefined;
  collectionId?: string | undefined;
  label: string;
  amount?: number | undefined;
  transactionId?: string | undefined;
  hiveTransactionId?: string | undefined;
  createdAt: string;
}

export type CreateActivityInput = Omit<ActivityDocument, "id" | "createdAt"> & {
  createdAt?: string | undefined;
};
