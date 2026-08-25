export type BannerTemplate = {
  templateId: number; // 100–199
  name: string;
  image: string;
  type: "banner";
  maxSupply: number | null; // null = unlimited (soulbound default)
  soulbound: boolean;
  price: number; // HASH cost; 0 = soulbound / not for sale
};

// Cosmetics have no rarity system, so every purchasable banner shares one
// flat price. Only the default (soulbound, free on register) template is
// priced differently.
//   100      → unlimited, soulbound (free on register), price: 0
//   101–124  → 1000 supply each, price: 1_000
export const bannerTemplates: BannerTemplate[] = [
  {
    templateId: 100,
    name: "The Data Mine",
    image: "/assets/banners/the-data-mine.png",
    type: "banner",
    maxSupply: null,
    soulbound: true,
    price: 0,
  },
  {
    templateId: 101,
    name: "Hash Canyon",
    image: "/assets/banners/hash-canyon.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 102,
    name: "The Vault District",
    image: "/assets/banners/the-vault-district.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 103,
    name: "Exploit City",
    image: "/assets/banners/exploit-city.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 104,
    name: "The Rig Farm",
    image: "/assets/banners/the-rig-farm.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 105,
    name: "Genesis Block",
    image: "/assets/banners/genesis-block.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 106,
    name: "Circuit Wasteland",
    image: "/assets/banners/circuit-wasteland.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 107,
    name: "The Network",
    image: "/assets/banners/the-network.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 108,
    name: "Raid Night",
    image: "/assets/banners/raid-night.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 109,
    name: "The Overclocked Sky",
    image: "/assets/banners/the-overclocked-sky.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 110,
    name: "Deep Protocol",
    image: "/assets/banners/deep-protocol.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 111,
    name: "Hash Horizon",
    image: "/assets/banners/hash-horizon.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 112,
    name: "The Dark Pool",
    image: "/assets/banners/the-dark-pool.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 113,
    name: "Firewall Fortress",
    image: "/assets/banners/firewall-fortress.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 114,
    name: "The Syndicate Lounge",
    image: "/assets/banners/the-syndicate-lounge.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 115,
    name: "Zero Day Dawn",
    image: "/assets/banners/zero-day-dawn.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 116,
    name: "Block Storm",
    image: "/assets/banners/block-storm.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 117,
    name: "Cold Storage",
    image: "/assets/banners/cold-storage.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 118,
    name: "Notoriety Row",
    image: "/assets/banners/notoriety-row.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 119,
    name: "The Patch",
    image: "/assets/banners/the-patch.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 120,
    name: "Liquidation Event",
    image: "/assets/banners/liquidation-event.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 121,
    name: "Genesis Crater",
    image: "/assets/banners/genesis-crater.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 122,
    name: "The Leaderboard Tower",
    image: "/assets/banners/the-leaderboard-tower.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 123,
    name: "Protocol Graveyard",
    image: "/assets/banners/protocol-graveyard.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
  {
    templateId: 124,
    name: "The Final Hash",
    image: "/assets/banners/the-final-hash.png",
    type: "banner",
    maxSupply: 1000,
    soulbound: false,
    price: 1_000,
  },
];

export const DEFAULT_BANNER_TEMPLATE_ID = 100;

export function getBannerByTemplateId(id: number): BannerTemplate | undefined {
  return bannerTemplates.find((b) => b.templateId === id);
}

export function getDefaultBanner(): BannerTemplate {
  return bannerTemplates[0]!;
}
