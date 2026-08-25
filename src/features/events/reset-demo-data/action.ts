import { appData, createDemoData } from "@/features/lib/data/app-data";

/**
 * Resets the local mock database to EMPTY collections and clears every
 * namespaced LocalStorage key. No fake NFT dataset is inserted — data is
 * created by using the application.
 */
export function resetDemoData(): void {
  appData.clear();
}

/** Explicit, developer-triggered demo catalogue (never runs automatically). */
export function loadDemoData(): void {
  appData.patch(createDemoData());
}
