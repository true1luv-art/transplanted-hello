import { describe, expect, it } from "vitest";

import { buildNftIssueCall, getSidechainId, prepareNftIssuance } from "./hive";
import { buildNftProperties } from "./nft-properties";

const properties = buildNftProperties({
  collection: "Otters Outbreak",
  symbol: "oo",
  metadataUri: "ipfs://cid/otters-1.json",
});

describe("prepareNftIssuance", () => {
  it("builds a sidechain custom_json signed by the user with the active key", () => {
    const issuance = prepareNftIssuance({ account: "Rhiaji", symbol: "oo", properties });

    expect(issuance.account).toBe("rhiaji");
    expect(issuance.to).toBe("rhiaji");
    expect(issuance.symbol).toBe("OO");
    expect(issuance.keyType).toBe("active");
    expect(issuance.sidechainId).toBe(getSidechainId());

    const [type, op] = issuance.operations[0]!;
    expect(type).toBe("custom_json");
    expect(op["required_auths"]).toEqual(["rhiaji"]);
    expect(op["required_posting_auths"]).toEqual([]);
    expect(op["id"]).toBe(getSidechainId());

    const call = JSON.parse(String(op["json"])) as ReturnType<typeof buildNftIssueCall>;
    expect(call.contractName).toBe("nft");
    expect(call.contractAction).toBe("issue");
    expect(call.contractPayload["symbol"]).toBe("OO");
    expect(call.contractPayload["to"]).toBe("rhiaji");
  });

  it("writes only the canonical properties, with metadata as the IPFS URI", () => {
    const call = buildNftIssueCall({ account: "rhiaji", symbol: "OO", properties });
    const props = call.contractPayload["properties"] as Record<string, unknown>;

    expect(Object.keys(props).sort()).toEqual(["collection", "metadata", "symbol"]);
    expect(typeof props["metadata"]).toBe("string");
    expect(props["metadata"]).toBe("ipfs://cid/otters-1.json");
    expect(props["symbol"]).toBe("OO");
  });

  it("never invents a token id and refuses incomplete input", () => {
    expect(() => prepareNftIssuance({ account: "", symbol: "OO", properties })).toThrow();
    expect(() => prepareNftIssuance({ account: "rhiaji", symbol: "", properties })).toThrow();
    expect(() =>
      prepareNftIssuance({
        account: "rhiaji",
        symbol: "OO",
        properties: { ...properties, metadata: "" },
      }),
    ).toThrow();
  });
});
