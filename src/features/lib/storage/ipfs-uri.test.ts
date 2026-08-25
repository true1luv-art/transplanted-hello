import { describe, expect, it } from "vitest";

import { isIpfsUri, parseIpfsUri, resolveIpfsUrl, toIpfsUri } from "./ipfs-uri";

const CID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const GATEWAY = "https://gw.test/ipfs/";

describe("ipfs uri resolver", () => {
  it("parses ipfs:// references with and without a path", () => {
    expect(parseIpfsUri(`ipfs://${CID}`)).toEqual({ cid: CID, path: "" });
    expect(parseIpfsUri(`ipfs://${CID}/1.json`)).toEqual({ cid: CID, path: "1.json" });
  });

  it("parses gateway urls, /ipfs/ paths and bare CIDs", () => {
    expect(parseIpfsUri(`https://ipfs.io/ipfs/${CID}/a.png`)).toEqual({ cid: CID, path: "a.png" });
    expect(parseIpfsUri(`/ipfs/${CID}`)).toEqual({ cid: CID, path: "" });
    expect(parseIpfsUri(CID)).toEqual({ cid: CID, path: "" });
  });

  it("rejects invalid references", () => {
    for (const value of ["", "ipfs://", "ipfs://nope", "not-a-cid", null, undefined]) {
      expect(parseIpfsUri(value)).toBeNull();
      expect(isIpfsUri(value)).toBe(false);
    }
  });

  it("builds canonical uris", () => {
    expect(toIpfsUri(CID)).toBe(`ipfs://${CID}`);
    expect(toIpfsUri(CID, "/meta/1.json")).toBe(`ipfs://${CID}/meta/1.json`);
  });

  it("resolves to a public gateway url", () => {
    expect(resolveIpfsUrl(`ipfs://${CID}/x.png`, { gateway: GATEWAY })).toBe(
      `${GATEWAY}${CID}/x.png`,
    );
    expect(resolveIpfsUrl(`ipfs://${CID}`, { gateway: "https://gw.test/ipfs" })).toBe(
      `${GATEWAY}${CID}`,
    );
  });

  it("uses the reliable public Pinata gateway by default", () => {
    expect(resolveIpfsUrl(`ipfs://${CID}`)).toBe(
      `https://gateway.pinata.cloud/ipfs/${CID}`,
    );
  });

  it("passes through browser-usable urls and nulls unusable ones", () => {
    expect(resolveIpfsUrl("blob:abc")).toBe("blob:abc");
    expect(resolveIpfsUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
    expect(resolveIpfsUrl("https://cdn.test/a.png")).toBe("https://cdn.test/a.png");
    expect(resolveIpfsUrl("images/1.png")).toBeNull();
    expect(resolveIpfsUrl(undefined)).toBeNull();
  });
});
