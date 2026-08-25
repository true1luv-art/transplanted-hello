import { hive, num, shortDate } from "@/lib/format";
import { traitRarityContribution } from "@/features/lib/traits";
import { traitProbabilityKey } from "@/features/lib/traits/collection-frequency";
import type { NFT } from "@/features/types/domain/nfts";

/** Trait cards for the "Attributes" tab. */
export function AttributesGrid({
  nft,
  probabilities,
}: {
  nft: NFT;
  /** Observed trait probabilities across the collection (`trait\0value`). */
  probabilities?: Map<string, number> | undefined;
}) {
  const probabilityFor = (trait: string, value: string | number, fallback = 0) =>
    probabilities?.get(traitProbabilityKey(trait, value)) ?? fallback;

  if (nft.traits?.length) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {nft.traits.map((trait) => {
          const probability = probabilityFor(
            trait.layerName,
            trait.traitValueName,
            trait.probability,
          );
          const score = traitRarityContribution({ ...trait, probability });
          return (
            <li
              key={trait.layerId}
              className="rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                {trait.layerName}
              </p>
              <p className="mt-0.5 truncate font-display text-sm font-semibold">
                {trait.traitValueName}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                  {(probability * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  +{score.toFixed(2)} score
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {nft.attributes.map((a) => {
        const probability = probabilityFor(a.trait, a.value);
        return (
          <li key={a.trait} className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-[11px] tracking-wider text-muted-foreground uppercase">{a.trait}</p>
            <p className="mt-0.5 font-display text-sm font-semibold">{String(a.value)}</p>
            {probability > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-primary">
                  {(probability * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  +{(1 / probability).toFixed(2)} score
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}


/** Token metadata rows for the "Metadata" tab. */
export function MetadataRows({ nft }: { nft: NFT }) {
  return (
    <dl className="space-y-3 text-sm">
      <Row label="Name" value={nft.name} />
      <Row label="Mint" value={`#${nft.mintNumber}`} />
      <Row label="Max supply" value={num(nft.maxSupply)} />
      <Row label="Metadata URI" value={nft.metadataUri} mono />
      <div>
        <dt className="text-muted-foreground">Description</dt>
        <dd className="mt-1 leading-relaxed text-muted-foreground">{nft.description}</dd>
      </div>
    </dl>
  );
}

/** On-chain facts for the "Blockchain" tab. */
export function BlockchainRows({ nft }: { nft: NFT }) {
  return (
    <dl className="space-y-3 text-sm">
      <Row label="Network" value="Hive" />
      <Row label="NFT standard" value="Hive Engine NFT" />
      <Row label="Collection" value={nft.collectionName} />
      <Row label="Token ID" value={nft.tokenId === null ? "Not minted" : String(nft.tokenId)} mono />
      <Row
        label="Mint number"
        value={nft.NftMintedNumber === null ? "Not minted" : `#${nft.NftMintedNumber}`}
      />
      <Row label="File number" value={`#${nft.mintNumber}`} />
      <Row label="Owner" value={`@${nft.owner}`} />
      <Row label="Minted" value={shortDate(nft.createdAt)} />
      <Row label="Estimated value" value={hive(nft.estimatedValue)} />
    </dl>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? "truncate font-mono text-xs" : "text-right font-medium"}>{value}</dd>
    </div>
  );
}
