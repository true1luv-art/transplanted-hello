export type AvatarTemplate = {
  templateId: number; // 0–99
  name: string;
  image: string;
  type: "avatar";
  maxSupply: number | null; // null = unlimited (soulbound default)
  soulbound: boolean;
  price: number; // HASH cost; 0 = soulbound / not for sale
};

// Cosmetics have no rarity system, so every purchasable avatar shares one
// flat price. Only the default (soulbound, free on register) template is
// priced differently.
//   0    → unlimited, soulbound (free on register), price: 0
//   1–24 → 1000 supply each, price: 500
export const avatarTemplates: AvatarTemplate[] = [
  {
    templateId: 0,
    name: "The Operator",
    image: "/assets/avatars/the-operator.png",
    type: "avatar",
    maxSupply: null,
    soulbound: true,
    price: 0,
  },
  {
    templateId: 1,
    name: "The Rig Runner",
    image: "/assets/avatars/the-rig-runner.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 2,
    name: "The Ghost",
    image: "/assets/avatars/the-ghost.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 3,
    name: "The Overclocker",
    image: "/assets/avatars/the-overclocker.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 4,
    name: "The Vault Keeper",
    image: "/assets/avatars/the-vault-keeper.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 5,
    name: "The Exploit",
    image: "/assets/avatars/the-exploit.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 6,
    name: "The Node",
    image: "/assets/avatars/the-node.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 7,
    name: "The Miner King",
    image: "/assets/avatars/the-miner-king.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 8,
    name: "The Phantom",
    image: "/assets/avatars/the-phantom.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 9,
    name: "The Architect",
    image: "/assets/avatars/the-architect.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 10,
    name: "The Rogue AI",
    image: "/assets/avatars/the-rogue-ai.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 11,
    name: "The Nomad",
    image: "/assets/avatars/the-nomad.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 12,
    name: "The Cryptobro",
    image: "/assets/avatars/the-cryptobro.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 13,
    name: "The Scavenger",
    image: "/assets/avatars/the-scavenger.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 14,
    name: "The Warlord",
    image: "/assets/avatars/the-warlord.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 15,
    name: "The Shadow Broker",
    image: "/assets/avatars/the-shadow-broker.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 16,
    name: "The Zero-Day",
    image: "/assets/avatars/the-zero-day.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 17,
    name: "The Blockchain Monk",
    image: "/assets/avatars/the-blockchain-monk.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 18,
    name: "The Ice Queen",
    image: "/assets/avatars/the-ice-queen.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 19,
    name: "The Payload",
    image: "/assets/avatars/the-payload.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 20,
    name: "The Ferret",
    image: "/assets/avatars/the-ferret.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 21,
    name: "The Sentry",
    image: "/assets/avatars/the-sentry.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 22,
    name: "The Drain",
    image: "/assets/avatars/the-drain.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 23,
    name: "The Oracle",
    image: "/assets/avatars/the-oracle.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
  {
    templateId: 24,
    name: "The Syndicate Boss",
    image: "/assets/avatars/the-syndicate-boss.png",
    type: "avatar",
    maxSupply: 1000,
    soulbound: false,
    price: 500,
  },
];

export const DEFAULT_AVATAR_TEMPLATE_ID = 0;

export function getAvatarByTemplateId(id: number): AvatarTemplate | undefined {
  return avatarTemplates.find((a) => a.templateId === id);
}

export function getDefaultAvatar(): AvatarTemplate {
  return avatarTemplates[0]!;
}
