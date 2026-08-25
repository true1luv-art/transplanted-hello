import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, BadgeCheck, Crown, Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

import { ActivityFeed } from "@/components/ActivityFeed";
import { EmptyState } from "@/components/EmptyState";
import { ListingModal } from "@/components/ListingModal";
import { AttributesGrid, BlockchainRows, MetadataRows } from "@/components/MetadataPanel";
import { IpfsImage } from "@/components/IpfsImage";
import { PurchaseModal } from "@/components/PurchaseModal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hive } from "@/lib/format";
import { useAppStore } from "@/features/stores/app-store";

export const Route = createFileRoute("/nfts/$id")({
  head: () => ({
    meta: [
      { title: "NFT details — HiveX NFTs" },
      {
        name: "description",
        content: "NFT metadata, rarity, ownership history and marketplace actions.",
      },
      { property: "og:title", content: "NFT details — HiveX NFTs" },
      { property: "og:description", content: "Inspect a Hive NFT and trade it in HIVE." },
    ],
  }),
  component: NftDetail,
});

function NftDetail() {
  const { id } = Route.useParams();
  const nft = useAppStore((s) => s.nfts.find((n) => n.id === id));
  const listing = useAppStore((s) => s.listings.find((l) => l.nftId === id));
  const collection = useAppStore((s) => s.collections.find((c) => c.id === nft?.collectionId));
  const activities = useAppStore((s) => s.activities);
  const user = useAppStore((s) => s.user);
  const cancelListing = useAppStore((s) => s.cancelListing);
  const transferNFT = useAppStore((s) => s.transferNFT);

  const [listOpen, setListOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferring, setTransferring] = useState(false);

  const history = useMemo(() => activities.filter((a) => a.nftId === id), [activities, id]);

  // Trait rarity for imported/chain-minted tokens comes from observed
  // frequencies inside the collection, not from creator weights.
  const probabilities = useMemo(() => {
    const collectionId = nft?.collectionId;
    if (!collectionId) return undefined;
    const population = [
      ...allNfts.filter((n) => n.collectionId === collectionId),
      ...nftAssets.filter(
        (a) => a.collectionId === collectionId && !allNfts.some((n) => n.id === a.id),
      ),
    ];
    return buildTraitProbabilities(population);
  }, [allNfts, nftAssets, nft?.collectionId]);


  if (!nft) {
    return (
      <EmptyState
        title="NFT not found"
        description="This token no longer exists in the local prototype state."
        action={
          <Button asChild variant="outline">
            <Link to="/collections">Back to collections</Link>
          </Button>
        }
      />
    );
  }

  const isOwner = user?.username === nft.owner;
  const price = listing ? listing.price : nft.estimatedValue;
  const floor = collection?.floorPrice ?? 0;
  const floorDiff = floor ? ((price - floor) / floor) * 100 : 0;

  const doTransfer = async () => {
    if (!transferTo.trim()) return;
    setTransferring(true);
    try {
      await transferNFT(nft.id, transferTo.trim().replace(/^@/, ""));
      toast.success("NFT transferred", { description: `Sent to @${transferTo.replace(/^@/, "")}` });
      setTransferTo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link
          to="/collections/$id"
          params={{ id: nft.collectionId }}
          className="hover:text-foreground"
        >
          {nft.collectionName}
        </Link>
        <span className="px-2">/</span>
        <span className="text-foreground">{nft.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="surface-card overflow-hidden self-start">
          <IpfsImage
            src={nft.image}
            alt={`${nft.name} artwork`}
            className="aspect-square w-full object-cover"
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <h1 className="font-display text-2xl font-bold break-words sm:text-3xl">{nft.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {nft.collectionName}
                <BadgeCheck className="size-4 text-primary" aria-label="Verified" />
              </span>
              <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-xs text-success">
                Rank #{nft.rarityRank}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Crown className="size-4 text-primary" />
                {collection?.creatorFee ?? 0}%
              </span>
              <span className="ml-auto text-muted-foreground">
                Owned by: <span className="text-foreground">@{nft.owner}</span>
              </span>
            </div>
          </div>

          <section className="surface-card p-5">
            <p className="text-sm text-muted-foreground">
              {listing ? "Total Price" : "Estimated value"}
            </p>
            <p className="mt-1 font-display text-4xl font-bold">{hive(price)}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              {!isOwner && listing ? (
                <Button size="lg" className="flex-1" onClick={() => setBuyOpen(true)}>
                  Buy now
                </Button>
              ) : null}
              {isOwner && !listing ? (
                <Button size="lg" className="flex-1 gap-2" onClick={() => setListOpen(true)}>
                  <Tag className="size-4" /> List for sale
                </Button>
              ) : null}
              {isOwner && listing ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    cancelListing(listing.id);
                    toast.success("Listing cancelled");
                  }}
                >
                  Cancel listing
                </Button>
              ) : null}
              {!isOwner && !listing ? (
                <Button size="lg" variant="outline" className="flex-1" disabled>
                  Not listed
                </Button>
              ) : null}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="List Price" value={listing ? hive(listing.price) : "—"} />
              <MiniStat label="Floor Price" value={floor ? hive(floor) : "—"} />
              <MiniStat
                label="Floor Diff."
                value={floor ? `${floorDiff >= 0 ? "+" : ""}${floorDiff.toFixed(1)}%` : "—"}
              />
              <MiniStat label="Rarity score" value={nft.rarityScore.toFixed(2)} />
            </dl>

            {isOwner && !listing ? (
              <div className="mt-5 border-t border-border pt-5">
                <p className="text-xs tracking-wider text-muted-foreground uppercase">Transfer</p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    placeholder="hive username"
                  />
                  <Button
                    variant="outline"
                    onClick={doTransfer}
                    disabled={transferring || !transferTo.trim()}
                    className="gap-2"
                  >
                    {transferring ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="size-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <Tabs defaultValue="attributes" className="surface-card min-w-0 p-5">
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1">
              <TabsTrigger value="attributes">Attributes</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
              <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
            </TabsList>
            <TabsContent value="attributes" className="mt-4">
              <AttributesGrid nft={nft} />
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              <ActivityFeed activities={history} />
            </TabsContent>
            <TabsContent value="metadata" className="mt-4">
              <MetadataRows nft={nft} />
            </TabsContent>
            <TabsContent value="blockchain" className="mt-4">
              <BlockchainRows nft={nft} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ListingModal nft={nft} open={listOpen} onOpenChange={setListOpen} />
      {listing ? (
        <PurchaseModal nft={nft} listing={listing} open={buyOpen} onOpenChange={setBuyOpen} />
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
