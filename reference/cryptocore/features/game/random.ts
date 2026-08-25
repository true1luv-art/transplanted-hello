const ADJECTIVES = [
  "Quantum",
  "Rusted",
  "Hyper",
  "Cryo",
  "Neon",
  "Solar",
  "Void",
  "Titan",
  "Phantom",
  "Turbo",
  "Obsidian",
  "Arc",
  "Halo",
  "Nova",
  "Iron",
  "Ghost",
];

const NOUNS: Record<string, string[]> = {
  asicMiner: ["Hasher", "Digger", "Grinder", "Breaker", "Driller"],
  motherboard: ["Backplane", "Lattice", "Substrate", "Mainboard", "Spine"],
  powerSupply: ["Cell", "Reactor", "Dynamo", "Feeder", "Capacitor"],
  coolingSystem: ["Radiator", "Chiller", "Vortex", "Heatsink", "Cyclone"],
  networkModule: ["Uplink", "Relay", "Mesh", "Antenna", "Router"],
  firmwareChip: ["Kernel", "Firmware", "Microcode", "Bootrom", "Cipher"],
};

const SUFFIXES = ["MK I", "MK II", "MK III", "X", "Pro", "Prime", "Zero", "9000"];

export const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randomFloat = (min: number, max: number): number => Math.random() * (max - min) + min;

export const pickOne = <T>(items: readonly T[]): T => items[randomInt(0, items.length - 1)] as T;

export const shuffle = <T>(items: readonly T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    const a = copy[i] as T;
    const b = copy[j] as T;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
};

export const createId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const equipmentName = (slot: string): string => {
  const nouns = NOUNS[slot] ?? ["Module"];
  return `${pickOne(ADJECTIVES)} ${pickOne(nouns)} ${pickOne(SUFFIXES)}`;
};

const HANDLE_PREFIX = [
  "sat",
  "hodl",
  "zk",
  "sol",
  "block",
  "byte",
  "cyber",
  "mint",
  "hash",
  "gas",
  "dark",
  "moon",
];
const HANDLE_SUFFIX = [
  "whale",
  "miner",
  "runner",
  "ghost",
  "punk",
  "node",
  "rig",
  "ape",
  "wolf",
  "raider",
  "hunter",
  "chad",
];

/** Local generator — no faker dependency. */
export const randomUsername = (): string =>
  `${pickOne(HANDLE_PREFIX)}${pickOne(HANDLE_SUFFIX)}${randomInt(10, 999)}`;

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Stub Solana-style wallet address for generated rivals. */
export const randomAddress = (): string =>
  Array.from({ length: 44 }, () => pickOne(BASE58.split(""))).join("");
