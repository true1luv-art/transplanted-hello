import { describe, expect, it } from "vitest";
import {
  appendNfts,
  buildCollectionMetadata,
  normalizeTraitDefinitions,
} from "@/features/lib/metadata";

const nft = (n: number) => ({
  name: `OTTERS #${n}`,
  description: "yes yes show!",
  image: `images/otters-#${n}.png`,
  attributes: [{ trait_type: "background", value: "Lavander Haze" }],
});

const base = {
  name: "Otters Outbreak",
  description: "yes yes show!",
  width: 512,
  height: 512,
  traits: { background: [{ name: "Lavander Haze", weight: 50 }] },
};

describe("collection manifest", () => {
  it("contains the complete metadata of every NFT", () => {
    const manifest = buildCollectionMetadata({ ...base, nfts: [nft(1), nft(2)] });
    expect(manifest.nfts).toHaveLength(2);
    expect(manifest.nfts[0]).toEqual(nft(1));
    expect(Object.keys(manifest.nfts[0]!)).not.toContain("metadata");
  });

  it("appends new NFTs while keeping the complete set", () => {
    const v1 = buildCollectionMetadata({ ...base, nfts: [nft(1), nft(2)] });
    const v2 = appendNfts(v1, [nft(3)]);
    expect(v2.nfts.map((n) => n.name)).toEqual(["OTTERS #1", "OTTERS #2", "OTTERS #3"]);
    expect(v2.traits).toEqual(v1.traits);
  });

  it("rejects incomplete manifests", () => {
    expect(() => buildCollectionMetadata({ ...base, description: "", nfts: [nft(1)] })).toThrow(
      /description/,
    );
  });

  it("normalises trait definitions read back from a manifest", () => {
    expect(normalizeTraitDefinitions({ eyes: ["Cool Glasses"] })).toEqual({
      eyes: [{ name: "Cool Glasses", weight: 50 }],
    });
  });
});
