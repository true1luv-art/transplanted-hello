/**
 * Storage provider registry.
 *
 * Application code imports `getStorageProvider()` and the `StorageProvider`
 * type — never a concrete provider.
 *
 * In the browser the provider is `ApiStorageProvider`: uploads go to our own
 * `/api/ipfs/upload` endpoint which talks to Pinata server-side. Outside the
 * browser (SSR, tests) the deterministic `MockIPFSProvider` is used so nothing
 * touches the network.
 */
import { MockIPFSProvider } from "@/features/mocks/mock-ipfs";
import { ApiStorageProvider } from "./api-storage-provider";
import type { StorageProvider } from "./types";

interface StorageGlobal {
  __hivemint_storage?: StorageProvider | undefined;
}
const store = globalThis as unknown as StorageGlobal;

export function getStorageProvider(): StorageProvider {
  if (!store.__hivemint_storage) {
    store.__hivemint_storage =
      typeof window === "undefined" ? new MockIPFSProvider() : new ApiStorageProvider();
  }
  return store.__hivemint_storage;
}

/** Test / DI hook. */
export function setStorageProvider(provider: StorageProvider): void {
  store.__hivemint_storage = provider;
}

export type { StorageProvider };
