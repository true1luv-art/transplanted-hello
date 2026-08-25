import type { Rarity, SlotKey } from "@/features/types/game";

export type EquipmentTemplate = {
  templateId: number; // 1000–6999, slot-ranged
  name: string;
  slot: SlotKey;
  rarity: Rarity;
  image: string; // /assets/items/<slot>-<rarity>.png
};

// ─── ID ranges ────────────────────────────────────────────────────────────────
// asicMiner     1000–1999
// motherboard   2000–2999
// powerSupply   3000–3999
// coolingSystem 4000–4999
// networkModule 5000–5999
// firmwareChip  6000–6999
//
// Within each range: x000=common, x001=uncommon, x002=rare, x003=epic, x004=legendary
// ──────────────────────────────────────────────────────────────────────────────

export const equipmentTemplates: EquipmentTemplate[] = [
  // ── ASIC Miner (1000–1004) ──────────────────────────────────────────────────
  {
    templateId: 1000,
    name: "Scrapyard ASIC",
    slot: "asicMiner",
    rarity: "common",
    image: "/assets/items/asic-miner-common.png",
  },
  {
    templateId: 1001,
    name: "Refurbished ASIC",
    slot: "asicMiner",
    rarity: "uncommon",
    image: "/assets/items/asic-miner-uncommon.png",
  },
  {
    templateId: 1002,
    name: "CoreStrike ASIC",
    slot: "asicMiner",
    rarity: "rare",
    image: "/assets/items/asic-miner-rare.png",
  },
  {
    templateId: 1003,
    name: "Phantom Core MK-I",
    slot: "asicMiner",
    rarity: "epic",
    image: "/assets/items/asic-miner-epic.png",
  },
  {
    templateId: 1004,
    name: "Sovereign Hash Engine",
    slot: "asicMiner",
    rarity: "legendary",
    image: "/assets/items/asic-miner-legendary.png",
  },

  // ── Motherboard (2000–2004) ─────────────────────────────────────────────────
  {
    templateId: 2000,
    name: "Bare PCB",
    slot: "motherboard",
    rarity: "common",
    image: "/assets/items/motherboard-common.png",
  },
  {
    templateId: 2001,
    name: "Budget Baseboard",
    slot: "motherboard",
    rarity: "uncommon",
    image: "/assets/items/motherboard-uncommon.png",
  },
  {
    templateId: 2002,
    name: "CrossLink MX",
    slot: "motherboard",
    rarity: "rare",
    image: "/assets/items/motherboard-rare.png",
  },
  {
    templateId: 2003,
    name: "Nexus Prime Board",
    slot: "motherboard",
    rarity: "epic",
    image: "/assets/items/motherboard-epic.png",
  },
  {
    templateId: 2004,
    name: "OmniCore Ultraboard",
    slot: "motherboard",
    rarity: "legendary",
    image: "/assets/items/motherboard-legendary.png",
  },

  // ── Power Supply (3000–3004) ────────────────────────────────────────────────
  {
    templateId: 3000,
    name: "Wall Brick PSU",
    slot: "powerSupply",
    rarity: "common",
    image: "/assets/items/power-supply-common.png",
  },
  {
    templateId: 3001,
    name: "Bronze Rail PSU",
    slot: "powerSupply",
    rarity: "uncommon",
    image: "/assets/items/power-supply-uncommon.png",
  },
  {
    templateId: 3002,
    name: "Titanium Grid PSU",
    slot: "powerSupply",
    rarity: "rare",
    image: "/assets/items/power-supply-rare.png",
  },
  {
    templateId: 3003,
    name: "Surge Sovereign PSU",
    slot: "powerSupply",
    rarity: "epic",
    image: "/assets/items/power-supply-epic.png",
  },
  {
    templateId: 3004,
    name: "Infinite Rail Core",
    slot: "powerSupply",
    rarity: "legendary",
    image: "/assets/items/power-supply-legendary.png",
  },

  // ── Cooling System (4000–4004) ──────────────────────────────────────────────
  {
    templateId: 4000,
    name: "Box Fan Rig",
    slot: "coolingSystem",
    rarity: "common",
    image: "/assets/items/cooling-system-common.png",
  },
  {
    templateId: 4001,
    name: "Dual Heatsink",
    slot: "coolingSystem",
    rarity: "uncommon",
    image: "/assets/items/cooling-system-uncommon.png",
  },
  {
    templateId: 4002,
    name: "Liquid Loop Cooler",
    slot: "coolingSystem",
    rarity: "rare",
    image: "/assets/items/cooling-system-rare.png",
  },
  {
    templateId: 4003,
    name: "CryoVault Module",
    slot: "coolingSystem",
    rarity: "epic",
    image: "/assets/items/cooling-system-epic.png",
  },
  {
    templateId: 4004,
    name: "Absolute Zero Array",
    slot: "coolingSystem",
    rarity: "legendary",
    image: "/assets/items/cooling-system-legendary.png",
  },

  // ── Network Module (5000–5004) ──────────────────────────────────────────────
  {
    templateId: 5000,
    name: "Coax Stub",
    slot: "networkModule",
    rarity: "common",
    image: "/assets/items/network-module-common.png",
  },
  {
    templateId: 5001,
    name: "Mesh Adapter",
    slot: "networkModule",
    rarity: "uncommon",
    image: "/assets/items/network-module-uncommon.png",
  },
  {
    templateId: 5002,
    name: "Deep Packet NIC",
    slot: "networkModule",
    rarity: "rare",
    image: "/assets/items/network-module-rare.png",
  },
  {
    templateId: 5003,
    name: "Ghost Protocol NIC",
    slot: "networkModule",
    rarity: "epic",
    image: "/assets/items/network-module-epic.png",
  },
  {
    templateId: 5004,
    name: "Zero-Latency Darknet",
    slot: "networkModule",
    rarity: "legendary",
    image: "/assets/items/network-module-legendary.png",
  },

  // ── Firmware Chip (6000–6004) ───────────────────────────────────────────────
  {
    templateId: 6000,
    name: "Factory ROM",
    slot: "firmwareChip",
    rarity: "common",
    image: "/assets/items/firmware-chip-common.png",
  },
  {
    templateId: 6001,
    name: "Patched BIOS",
    slot: "firmwareChip",
    rarity: "uncommon",
    image: "/assets/items/firmware-chip-uncommon.png",
  },
  {
    templateId: 6002,
    name: "Exploit Microcode",
    slot: "firmwareChip",
    rarity: "rare",
    image: "/assets/items/firmware-chip-rare.png",
  },
  {
    templateId: 6003,
    name: "Phantom Kernel v2",
    slot: "firmwareChip",
    rarity: "epic",
    image: "/assets/items/firmware-chip-epic.png",
  },
  {
    templateId: 6004,
    name: "Sovereign Override",
    slot: "firmwareChip",
    rarity: "legendary",
    image: "/assets/items/firmware-chip-legendary.png",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getEquipmentTemplateById(id: number): EquipmentTemplate | undefined {
  return equipmentTemplates.find((t) => t.templateId === id);
}

export function getEquipmentTemplatesBySlot(slot: SlotKey): EquipmentTemplate[] {
  return equipmentTemplates.filter((t) => t.slot === slot);
}

/**
 * Returns the templateId for a given slot + rarity combination.
 * Used by chest.server.ts to stamp templateId on newly minted items.
 */
export function getTemplateIdForSlotRarity(slot: SlotKey, rarity: Rarity): number {
  const t = equipmentTemplates.find((t) => t.slot === slot && t.rarity === rarity);
  if (!t) throw new Error(`No equipment template found for slot="${slot}" rarity="${rarity}"`);
  return t.templateId;
}
