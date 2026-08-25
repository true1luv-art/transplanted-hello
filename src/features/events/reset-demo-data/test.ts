import { describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { loadDemoData, resetDemoData } from "./action";

describe("resetDemoData", () => {
  it("resets the mock database to empty collections", () => {
    appData.patch(createDemoData());
    resetDemoData();

    const data = appData.read();
    expect(data.collections).toEqual([]);
    expect(data.nftAssets).toEqual([]);
    expect(data.nfts).toEqual([]);
    expect(data.listings).toEqual([]);
    expect(data.activities).toEqual([]);
  });

  it("loads the demo catalogue only when explicitly requested", () => {
    resetDemoData();
    loadDemoData();
    expect(appData.read().collections.length).toBeGreaterThan(0);
    resetDemoData();
    expect(appData.read().collections).toEqual([]);
  });
});
