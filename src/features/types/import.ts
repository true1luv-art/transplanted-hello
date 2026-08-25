import type { UploadState } from "@/features/lib/import/pipeline";
import type { ImportReport } from "@/features/lib/import/types";
import type { CollectionTraitValue } from "@/features/lib/storage/collection-manifest";
import type { Collection } from "@/features/types/domain/collections";

/** Application-level contract for the "import collection" use case. */
export interface ImportCollectionInput {
  name: string;
  symbol: string;
  description: string;
  mintPrice: number;
  /** Mint window — stored in the database, never in IPFS metadata. */
  mintStartDate?: string | null;
  mintEndDate?: string | null;
  /** Cover artwork chosen by the creator. */
  collectionImage: File;
  /** Object URL used as the collection's display image. */
  collectionImageUrl: string;
  /** Validated import report — must be `ready`. */
  report: ImportReport;
  /** Extracted NFT image bytes, keyed by filename. */
  imageFiles: Map<string, File>;
  /** Image used when an imported token has no preview or pinned asset. */
  fallbackImage: string;
  /** Canvas size + complete trait system from the imported manifest. */
  manifest?:
    | {
        width?: number | undefined;
        height?: number | undefined;
        traits?: Record<string, CollectionTraitValue[]> | undefined;
      }
    | undefined;
  /** Creator's available HIVE balance, checked before any upload happens. */
  balance: number;
}

export interface ImportCollectionOptions {
  onUploadState?: (state: UploadState) => void;
}

export type ImportCollectionResult = Collection;
