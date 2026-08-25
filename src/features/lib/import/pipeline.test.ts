import { beforeEach, describe, expect, it } from "vitest";

import { setStorageProvider } from "@/features/lib/storage/storage";
import type {
  StorageDirectory,
  StorageFileInput,
  StorageObject,
  StorageProvider,
} from "@/features/lib/storage/types";
import { uploadImportedCollection } from "./pipeline";
import type { ImportedNft } from "./types";

const now = () => new Date().toISOString();

function testProvider(captured: { directories: { name: string; files: StorageFileInput[] }[] }) {
  const object = (cid: string, filename: string, mimeType: string): StorageObject => ({
    cid,
    uri: `ipfs://${cid}`,
    filename,
    mimeType,
    size: 1,
    createdAt: now(),
  });

  const provider: StorageProvider = {
    name: "import-test",
    uploadFile: async (file) => object(`cid-file-${file.filename}`, file.filename, file.mimeType),
    uploadFiles: async (files) =>
      files.map((file) => object(`cid-file-${file.filename}`, file.filename, file.mimeType)),
    uploadJson: async (filename) => object(`cid-json-${filename}`, filename, "application/json"),
    uploadDirectory: async (name, files): Promise<StorageDirectory> => {
      captured.directories.push({ name, files });
      const cid = `cid-dir-${name}`;
      return {
        cid,
        uri: `ipfs://${cid}`,
        size: files.length,
        createdAt: now(),
        entries: files.map((file) => ({
          cid,
          uri: `ipfs://${cid}/${file.filename}`,
          filename: file.filename,
          mimeType: file.mimeType,
          size: 1,
          createdAt: now(),
        })),
      };
    },
    getUri: (cid, path) => (path ? `ipfs://${cid}/${path}` : `ipfs://${cid}`),
    pin: async () => {},
    unpin: async () => {},
  };
  return provider;
}

const importedNft = (tokenId: number, batch: string, filename: string): ImportedNft => ({
  sourceFile: `${batch}/metadata/${tokenId}.json`,
  sourceIndex: 0,
  name: `Otter #${tokenId}`,
  description: "Imported otter",
  image: `images/${filename}`,
  attributes: [{ trait_type: "Fur", value: "Gold", name: "Golden Fur", weight: 25 }],
  raw: {
    name: `Otter #${tokenId}`,
    description: "Imported otter",
    image: `images/${filename}`,
    edition: tokenId,
    attributes: [{ trait_type: "Fur", value: "Gold", name: "Golden Fur", weight: 25 }],
  },
  tokenId,
  tokenIdSource: "edition",
  imageKey: filename,
  matchedFilename: filename,
  rarityScore: tokenId,
  rarityRank: tokenId,
});

describe("uploadImportedCollection", () => {
  const captured = { directories: [] as { name: string; files: StorageFileInput[] }[] };

  beforeEach(() => {
    captured.directories = [];
    setStorageProvider(testProvider(captured));
  });

  it("uploads each imported batch into namespaced IPFS directories and stores file-level URIs", async () => {
    const bundle = await uploadImportedCollection({
      name: "Otters Outbreak",
      symbol: "OTBK",
      description: "Imported launch package",
      creator: "rhiaji",
      maxSupply: 3,
      mintPrice: 4,
      collectionImage: new File(["cover"], "cover.png", { type: "image/png" }),
      imageFiles: new Map([
        ["otter-#1.png", new File(["one"], "otter-#1.png", { type: "image/png" })],
        ["otter-#2.png", new File(["two"], "otter-#2.png", { type: "image/png" })],
        ["otter-#101.png", new File(["101"], "otter-#101.png", { type: "image/png" })],
      ]),
      nfts: [
        importedNft(1, "otters-outbreak-1-2", "otter-#1.png"),
        importedNft(2, "otters-outbreak-1-2", "otter-#2.png"),
        importedNft(101, "otters-outbreak-101-101", "otter-#101.png"),
      ],
    });

    expect(captured.directories.map((directory) => directory.name)).toEqual([
      "rhiaji-otbk-otters-outbreak-1-2-images",
      "rhiaji-otbk-otters-outbreak-1-2-metadata",
      "rhiaji-otbk-otters-outbreak-101-101-images",
      "rhiaji-otbk-otters-outbreak-101-101-metadata",
    ]);

    const first = bundle.items.find((item) => item.tokenId === 1);
    expect(first?.imageUri).toBe(
      "ipfs://cid-dir-rhiaji-otbk-otters-outbreak-1-2-images/otter-#1.png",
    );
    expect(first?.metadataUri).toBe(
      "ipfs://cid-dir-rhiaji-otbk-otters-outbreak-1-2-metadata/1.json",
    );
    expect(first).toMatchObject({
      imageCid: "cid-dir-rhiaji-otbk-otters-outbreak-1-2-images",
      metadataCid: "cid-dir-rhiaji-otbk-otters-outbreak-1-2-metadata",
      imageRootCid: "cid-dir-rhiaji-otbk-otters-outbreak-1-2-images",
      metadataRootCid: "cid-dir-rhiaji-otbk-otters-outbreak-1-2-metadata",
    });
    expect(bundle).toMatchObject({
      collectionImageCid: "cid-file-rhiaji-otbk-collection.png",
      collectionMetadataCid: "cid-json-rhiaji-otbk-collection.json",
      assetRootCids: [
        "cid-dir-rhiaji-otbk-otters-outbreak-1-2-images",
        "cid-dir-rhiaji-otbk-otters-outbreak-101-101-images",
      ],
      metadataRootCids: [
        "cid-dir-rhiaji-otbk-otters-outbreak-1-2-metadata",
        "cid-dir-rhiaji-otbk-otters-outbreak-101-101-metadata",
      ],
    });

    const metadataDirectory = captured.directories.find((directory) =>
      directory.name.endsWith("1-2-metadata"),
    );
    const metadataFile = metadataDirectory?.files.find((file) => file.filename === "1.json");
    expect(typeof metadataFile?.content).toBe("string");
    const metadata = JSON.parse(String(metadataFile?.content)) as Record<string, unknown>;
    expect(metadata["image"]).toBe(first?.imageUri);
    expect(metadata["symbol"]).toBeUndefined();
    // Canonical NFT metadata only: creator extras are dropped.
    expect(metadata["attributes"]).toEqual([{ trait_type: "Fur", value: "Gold" }]);
    expect(Object.keys(metadata).sort()).toEqual(["attributes", "description", "image", "name"]);
  });
});