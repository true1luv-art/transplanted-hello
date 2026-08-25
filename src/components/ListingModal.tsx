import { useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TransactionStatus, type TxState } from "@/components/TransactionStatus";
import { hive } from "@/lib/format";
import type { NFT } from "@/features/types/domain/nfts";
import { quoteListing } from "@/features/mocks/data/marketplace/model";
import { useAppStore } from "@/features/stores/app-store";

export function ListingModal({
  nft,
  open,
  onOpenChange,
}: {
  nft: NFT | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const listNFT = useAppStore((s) => s.listNFT);
  const [price, setPrice] = useState("50.00");
  const [state, setState] = useState<TxState>("idle");

  if (!nft) return null;

  const parsed = Number(price) || 0;
  const { fee, receive } = quoteListing(parsed);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setState("idle");
  };

  const submit = async () => {
    if (parsed <= 0) {
      toast.error("Enter a price greater than 0");
      return;
    }
    setState("pending");
    try {
      await listNFT(nft.id, parsed);
      setState("success");
      toast.success("NFT listed", { description: `${nft.name} · ${hive(parsed)}` });
    } catch (e) {
      setState("error");
      toast.error(e instanceof Error ? e.message : "Listing failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">List {nft.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listing-price">Price</Label>
            <div className="flex items-center gap-2">
              <Input
                id="listing-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={state === "pending" || state === "success"}
              />
              <span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">
                HIVE
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Marketplace fee</span>
              <span className="font-medium">2.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated receive</span>
              <span className="font-display text-lg font-semibold">
                {hive(Math.max(0, receive))}
              </span>
            </div>
          </div>

          <TransactionStatus state={state} successLabel="Listing is live on the marketplace" />

          {state === "success" ? (
            <Button variant="outline" className="w-full" onClick={() => close(false)}>
              Done
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={state === "pending"}
              size="lg"
              className="w-full gap-2"
            >
              {state === "pending" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Tag className="size-4" />
              )}
              {state === "pending" ? "Listing…" : "List NFT"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
