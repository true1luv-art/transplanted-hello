export type BackgroundTemplate = {
  templateId: number; // 200–299
  name: string;
  image: string;
  type: "background";
  maxSupply: number | null; // null = unlimited (soulbound default)
  soulbound: boolean;
  price: number; // HASH cost; 0 = soulbound / not for sale
};

// Cosmetics have no rarity system, so every purchasable background shares
// one flat price. Only the default (soulbound, free on register) template
// is priced differently.
//   200      → unlimited, soulbound (free on register), price: 0
//   201–224  → 1000 supply each, price: 1_500
export const backgroundTemplates: BackgroundTemplate[] = [
  {
    templateId: 200,
    name: "The Deep Mine",
    image: "/assets/backgrounds/the-deep-mine.png",
    type: "background",
    maxSupply: null,
    soulbound: true,
    price: 0,
  },
  {
    templateId: 201,
    name: "Circuit Horizon",
    image: "/assets/backgrounds/circuit-horizon.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 202,
    name: "Server Cathedral",
    image: "/assets/backgrounds/server-cathedral.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 203,
    name: "The Void Network",
    image: "/assets/backgrounds/the-void-network.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 204,
    name: "Hash Storm",
    image: "/assets/backgrounds/hash-storm.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 205,
    name: "The Cold Vault",
    image: "/assets/backgrounds/the-cold-vault.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 206,
    name: "Protocol Rain",
    image: "/assets/backgrounds/protocol-rain.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 207,
    name: "Genesis Crater",
    image: "/assets/backgrounds/genesis-crater.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 208,
    name: "The Rig Room",
    image: "/assets/backgrounds/the-rig-room.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 209,
    name: "Exploit Horizon",
    image: "/assets/backgrounds/exploit-horizon.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 210,
    name: "Deep Protocol Sea",
    image: "/assets/backgrounds/deep-protocol-sea.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 211,
    name: "Firewall Dusk",
    image: "/assets/backgrounds/firewall-dusk.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 212,
    name: "Binary Forest",
    image: "/assets/backgrounds/binary-forest.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 213,
    name: "The Mempool",
    image: "/assets/backgrounds/the-mempool.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 214,
    name: "Overclocked Night",
    image: "/assets/backgrounds/overclocked-night.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 215,
    name: "Notoriety Alley",
    image: "/assets/backgrounds/notoriety-alley.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 216,
    name: "Block Graveyard",
    image: "/assets/backgrounds/block-graveyard.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 217,
    name: "Cold Storage Facility",
    image: "/assets/backgrounds/cold-storage-facility.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 218,
    name: "The Hash Abyss",
    image: "/assets/backgrounds/the-hash-abyss.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 219,
    name: "Syndicate Tower",
    image: "/assets/backgrounds/syndicate-tower.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 220,
    name: "Liquidity Pool",
    image: "/assets/backgrounds/liquidity-pool.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 221,
    name: "Zero Day Sky",
    image: "/assets/backgrounds/zero-day-sky.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 222,
    name: "The Dark Pool Exchange",
    image: "/assets/backgrounds/the-dark-pool-exchange.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 223,
    name: "Proof of Work",
    image: "/assets/backgrounds/proof-of-work.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
  {
    templateId: 224,
    name: "The Final Block",
    image: "/assets/backgrounds/the-final-block.png",
    type: "background",
    maxSupply: 1000,
    soulbound: false,
    price: 1_500,
  },
];

export const DEFAULT_BACKGROUND_TEMPLATE_ID = 200;

export function getBackgroundByTemplateId(id: number): BackgroundTemplate | undefined {
  return backgroundTemplates.find((b) => b.templateId === id);
}

export function getDefaultBackground(): BackgroundTemplate {
  return backgroundTemplates[0]!;
}
