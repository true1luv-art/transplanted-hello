/**
 * Legacy `/nfts` entry point: forwards to the signed-in account's public
 * portfolio page at `/@username/nfts`.
 */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { useAppStore } from "@/features/stores/app-store";

export const Route = createFileRoute("/nfts/")({
  head: () => ({
    meta: [
      { title: "My NFTs — HiveX NFTs" },
      {
        name: "description",
        content: "Your Hive NFT portfolio: owned items, active listings and estimated value.",
      },
      { property: "og:title", content: "My NFTs — HiveX NFTs" },
      { property: "og:description", content: "Manage and list your Hive NFT collection." },
    ],
  }),
  component: MyNftsRedirect,
});

function MyNftsRedirect() {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      void navigate({
        to: "/@{$username}/nfts",
        params: { username: user.username },
        replace: true,
      });
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect a Hive account to view your NFT portfolio."
      />
    );
  }

  return null;
}
