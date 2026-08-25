import type { Metadata } from "next";

import { WikiPage } from "@/features/pages/WikiPage";

export const metadata: Metadata = {
  title: "Wiki — CryptoCore Game Documentation",
  description:
    "How CryptoCore works: mining rates, vault capacity, stat effects, chest drop odds, raid mechanics and marketplace fees.",
  openGraph: {
    title: "Wiki — CryptoCore Game Documentation",
    description:
      "Full reference for the $HASH economy: mining, stats, gear rarity, chest odds, raids and trading.",
    type: "article",
  },
  twitter: { card: "summary_large_image" },
};

export default function WikiRoutePage() {
  return <WikiPage />;
}
