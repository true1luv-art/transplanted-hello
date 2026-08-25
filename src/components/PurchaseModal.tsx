import { useState } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { IpfsImage } from "@/components/IpfsImage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TransactionStatus, type TxState } from "@/components/TransactionStatus";
import { hive } from "@/lib/format";
import type { Listing } from "@/features/types/domain/marketplace";
import type { NFT } from "@/features/types/domain/nfts";
import { quotePurchase } from "@/features/mocks/data/marketplace/model";
import { useAppStore } from "@/features/stores/app-store";

export function PurchaseModal({
  listing,
  nft,
  open,
  onOpenChange,
}: {
  listing: Listing | null;
  nft: NFT | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const buyNFT = useAppStore((s) => s.buyNFT);
  const [state, setState] = useState<TxState>("idle");
  const [txId, setTxId] = useState<string>("");

  if (!listing || !nft) return null;

  const { fee, total } = quotePurchase(listing.price);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setState("idle");
      setTxId("");
    }
  };

  const confirm = async () => {
    setState("pending");
    try {
      await buyNFT(listing.id);
      const latest = useAppStore.getState().transactions[0];
      setTxId(latest?.txId ?? "");
      setState("success");
      toast.success("Purchase complete", { description: `${nft.name} is now yours` });
    } catch (e) {
      setState("error");
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {state === "success" ? "Purchase Complete" : "Confirm Purchase"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4">
          <IpfsImage
            src={nft.image}
            alt={nft.name}
            className="size-24 rounded-xl border border-border object-cover"
          />
          <div className="min-w-0 text-sm">
            <p className="text-muted-foreground">{nft.collectionName}</p>
            <p className="truncate font-display text-base font-semibold">{nft.name}</p>
            <div className="mt-1.5"></div>
            <p className="mt-1.5 text-xs text-muted-foreground">Seller @{listing.seller}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span className="font-medium">{hive(listing.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Marketplace fee (2.5%)</span>
            <span className="font-medium">{hive(fee)}</span>
          </div>
          <div className="my-2 border-t border-border" />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-display text-lg font-semibold">{hive(total)}</span>
          </div>
        </div>

        <TransactionStatus state={state} txId={txId} successLabel="Ownership transferred on Hive" />

        {state === "success" ? (
          <Button onClick={() => close(false)} variant="outline" className="w-full">
            Done
          </Button>
        ) : (
          <Button
            onClick={confirm}
            disabled={state === "pending"}
            size="lg"
            className="w-full gap-2"
          >
            {state === "pending" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            {state === "pending" ? "Processing…" : "Confirm Purchase"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
