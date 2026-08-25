import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import type { ImportCollectionInput } from "@/features/types/import";
import type { ImportReport } from "@/features/lib/import/types";
import { usersRepository } from "@/features/mocks/data/users/repository";
import { importCollection } from "./action";

const report = (ready: boolean, totalNfts = 100) =>
  ({
    nfts: [],
    traits: [],
    statistics: { totalNfts },
    issues: [],
    ready,
  }) as unknown as ImportReport;

const input = (overrides: Partial<ImportCollectionInput> = {}): ImportCollectionInput => ({
  name: "Imported Bees",
  symbol: "impbee",
  description: "Imported collection",
  mintPrice: 2,
  collectionImage: new File(["cover"], "cover.png", { type: "image/png" }),
  collectionImageUrl: "blob:cover",
  report: report(true),
  imageFiles: new Map(),
  fallbackImage: "data:image/svg+xml,fallback",
  balance: 0,
  ...overrides,
});

describe("importCollection", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("refuses archives that failed validation", async () => {
    await expect(importCollection(input({ report: report(false) }))).rejects.toThrow(/not valid/);
    expect(appData.read().collections.some((c) => c.symbol === "IMPBEE")).toBe(false);
  });

  it("checks the creator balance before uploading anything", async () => {
    usersRepository.setBalance(usersRepository.currentUsername(), 1);
    await expect(importCollection(input({ balance: 1 }))).rejects.toThrow(/Insufficient/);
    expect(appData.read().collections.some((c) => c.symbol === "IMPBEE")).toBe(false);
  });
});
