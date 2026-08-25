import type { NFTAttribute } from "@/features/lib/metadata";

import { resolveIpfsUrl } from "./ipfs-uri";

/** Normalizes both OpenSea (`trait_type`) and app (`trait`) attribute shapes. */
export function normalizeNftAttributes(value: unknown): NFTAttribute[] {
  if (!Array.isArray(value)) return [];

  const attributes: NFTAttribute[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const traitValue = record["trait"] ?? record["trait_type"];
    const valueValue = record["value"];
    if (typeof traitValue !== "string" || !traitValue.trim()) continue;
    if (typeof valueValue !== "string" && typeof valueValue !== "number") continue;
    attributes.push({ trait_type: traitValue.trim(), value: String(valueValue) });
  }
  return attributes;
}

/** Reads and validates the attributes stored in a minted NFT's IPFS JSON. */
export async function loadIpfsNftAttributes(
  metadataUri: string,
  signal?: AbortSignal,
): Promise<NFTAttribute[]> {
  const url = resolveIpfsUrl(metadataUri);
  if (!url) throw new Error("NFT metadata does not have a valid IPFS URI");

  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`IPFS metadata unavailable (${response.status})`);

  const metadata = (await response.json()) as unknown;
  if (!metadata || typeof metadata !== "object") throw new Error("IPFS metadata is not an object");
  return normalizeNftAttributes((metadata as Record<string, unknown>)["attributes"]);
}