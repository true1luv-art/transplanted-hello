import { createFileRoute, Link } from "@tanstack/react-router";

import { CreateCollectionForm } from "@/components/CreateCollectionForm";

export const Route = createFileRoute("/creator/collections/new")({
  head: () => ({
    meta: [
      { title: "Create a Collection — HiveX NFTs" },
      {
        name: "description",
        content:
          "Configure supply, mint price, royalties and rarity weights, then deploy your Hive NFT collection.",
      },
      { property: "og:title", content: "Create a Collection — HiveX NFTs" },
      { property: "og:description", content: "Deploy a new NFT collection on Hive in minutes." },
    ],
  }),
  component: NewCollection,
});

function NewCollection() {
  return (
    <div className="space-y-8">
      <header>
        <nav className="text-sm text-muted-foreground">
          <Link to="/creator" className="hover:text-foreground">
            Creator
          </Link>
          <span className="px-2">/</span>
          <span className="text-foreground">New collection</span>
        </nav>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Create a Collection</h1>
        <p className="mt-2 text-muted-foreground">
          Set the economics and rarity curve. Deployment is simulated locally in this prototype.
        </p>
      </header>

      <CreateCollectionForm />
    </div>
  );
}
