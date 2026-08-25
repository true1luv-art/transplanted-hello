import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IpfsImage } from "@/components/IpfsImage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TransactionStatus, type TxState } from "@/components/TransactionStatus";
import { hive } from "@/lib/format";
import type { Collection } from "@/features/types/domain/collections";
import type { NFT } from "@/features/types/domain/nfts";
import { quoteMint } from "@/features/mocks/data/marketplace/model";
import { useAppStore } from "@/features/stores/app-store";
import { MintError } from "@/features/events/mint-nft-onchain/action";
import { nextMintableAsset } from "@/features/lib/mint/hive-mint.service";
import type { MintProgress } from "@/features/types/domain/mint";

export function MintModal({
  collection,
  open,
  onOpenChange,
}: {
  collection: Collection;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mintNftOnChain = useAppStore((s) => s.mintNftOnChain);
  const assets = useAppStore((s) => s.nftAssets);
  const [state, setState] = useState<TxState>("idle");
  const [progress, setProgress] = useState<MintProgress | null>(null);
  const [minted, setMinted] = useState<{ nft: NFT; txId: string } | null>(null);

  const available = assets.filter(
    (a) => a.collectionId === collection.id && a.status !== "minted" && a.NFTokenID === null,
  ).length;

  const { platformFee, total } = quoteMint(collection);

  const reset = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setState("idle");
      setMinted(null);
      setProgress(null);
    }
  };

  const confirm = async () => {
    const asset = nextMintableAsset(collection.id);
    setState("pending");
    setProgress({ stage: "preparing", message: "Preparing mint…" });
    try {
      const result = await mintNftOnChain({
        collectionId: collection.id,
        ...(asset ? { assetId: asset.id } : {}),
        onProgress: setProgress,
      });
      setMinted({ nft: result.nft, txId: result.txId });
      setState("success");
      toast.success("NFT minted on Hive", {
        description: `${result.nft.name} · token #${result.tokenId}`,
      });
    } catch (e) {
      setState("error");
      const message = e instanceof Error ? e.message : "Mint failed";
      if (e instanceof MintError && e.code === "TOKEN_ID_UNAVAILABLE") {
        toast.warning("Broadcast sent", { description: message });
      } else {
        toast.error("Mint failed", { description: message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        {state === "success" && minted ? (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">NFT Minted!</DialogTitle>
            </DialogHeader>
            <div className="overflow-hidden rounded-xl border border-border">
              <IpfsImage
                src={minted.nft.image}
                alt={minted.nft.name}
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold">{minted.nft.name}</span>
              </div>
              <Row label="Token ID" value={minted.nft.tokenId === null ? "Pending" : `#${minted.nft.tokenId}`} />
              <Row
                label="Mint number"
                value={minted.nft.NFTMintedNumber === null ? "—" : `#${minted.nft.NFTMintedNumber}`}
              />
              <Row label="Collection" value={collection.name} />
              <Row label="Hive transaction" value={minted.txId} mono />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link to="/nfts/$id" params={{ id: minted.nft.id }} onClick={() => reset(false)}>
                  View NFT
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/nfts" onClick={() => reset(false)}>
                  View My NFTs
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Mint from {collection.name}
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-4">
              <IpfsImage
                src={collection.image}
                alt={collection.name}
                className="size-20 rounded-xl border border-border object-cover"
              />
              <div className="text-sm">
                <p className="text-muted-foreground">Collection</p>
                <p className="font-display text-base font-semibold">{collection.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {available} unminted asset{available === 1 ? "" : "s"} ready
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
              <Row label="Mint price" value={hive(collection.mintPrice)} />
              <Row label="Platform fee" value={hive(platformFee)} />
              <div className="my-2 border-t border-border" />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-lg font-semibold">{hive(total)}</span>
              </div>
            </div>

            <TransactionStatus
              state={state === "pending" ? "pending" : state === "error" ? "error" : "idle"}
              pendingLabel={progress?.message ?? "Preparing mint…"}
              errorLabel="Mint failed"
            />

            <Button
              onClick={confirm}
              disabled={state === "pending" || available === 0}
              className="w-full gap-2"
              size="lg"
            >
              {state === "pending" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {state === "pending"
                ? "Minting…"
                : available === 0
                  ? "No unminted NFTs"
                  : "Mint on Hive"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}
