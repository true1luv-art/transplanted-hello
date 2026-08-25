/**
 * Legacy `/creator` entry point: forwards to the signed-in account's public
 * creator page at `/@username/creator`.
 */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EmptyState } from "@/components/EmptyState";
import { useAppStore } from "@/features/stores/app-store";

export const Route = createFileRoute("/creator/")({
  head: () => ({
    meta: [
      { title: "Creator Dashboard — HiveX NFTs" },
      {
        name: "description",
        content: "Track your collections, mint revenue, royalties and holders on HiveX NFTs.",
      },
      { property: "og:title", content: "Creator Dashboard — HiveX NFTs" },
      { property: "og:description", content: "Launch and manage NFT collections on Hive." },
    ],
  }),
  component: CreatorRedirect,
});

function CreatorRedirect() {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      void navigate({
        to: "/@{$username}/creator",
        params: { username: user.username },
        replace: true,
      });
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <EmptyState
        title="Connect your wallet"
        description="Connect a Hive account to manage your collections."
      />
    );
  }

  return null;
}
