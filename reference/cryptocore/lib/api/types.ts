export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PlayerDto {
  /** Solana address that owns this account. */
  address: string;
  username: string;
  registrationTime: number;
  xp: number;
  level: number;
  hash: number;
  sparks: number;
  vault: number;
  vaultStaked: number;
  notoriety: number;
  totalBurned: number;
  statLevels: {
    hashRate: number;
    hackPower: number;
    security: number;
    luck: number;
    firewall: number;
    exploit: number;
  };
  lastTickAt: number;
  lastSinkAt: number;
  claimCharges: number;
  lastClaimRegenAt: number;
  raidCharges: number;
  lastRaidRegenAt: number;
  milestones: {
    totalClaimed: number;
    totalMined: number;
    raids: number;
    raidWins: number;
    totalStolen: number;
    bestHashRate: number;
  };
  protectionUntil: number;
  referredBy: string | null;
  referralCount: number;
  referralEarned: number;
  /** Notoriety-gated withdrawal tracking. */
  withdrawnToday: number; // HASH withdrawn in the current 24-hour window
  withdrawResetAt: number; // epoch ms when withdrawnToday resets
  /**
   * Server-authoritative equipped cosmetics, resolved to numeric template IDs
   * for direct rendering by the client. Each field is the templateId of the
   * equipped asset, or null if nothing of that kind is equipped.
   */
  profile: {
    avatar: number | null;
    banner: number | null;
    background: number | null;
  } | null;
}

export interface ItemMarketDto {
  price: number;
  listedAt: number;
  isMarket: boolean;
}

export interface ItemDto {
  itemNumber: number;
  templateId: number;
  mintNumber: number;
  owner: string;
  name: string;
  slot: string;
  rarity: string;
  level: number;
  stats: Record<string, number>;
  equipped: boolean;
  salvaged: boolean;
  market: ItemMarketDto | null;
  createdAt: number;
  lastTransfer: number;
}

/** Unified listing DTO — covers both cosmetic assets and equipment items. */
export interface MarketListingDto {
  kind: "asset" | "item";
  /** assetNumber (assets) or itemNumber (items). */
  refId: number;
  templateId: number;
  owner: string;
  price: number;
  listedAt: number;
  /** Resolved from the template (assets) or item doc (items). */
  name: string;
  /** Item-only — null for cosmetic assets. */
  slot: string | null;
  rarity: string | null;
  level: number | null;
  /** Item-only — null for cosmetic assets. */
  stats: Record<string, number> | null;
}

export interface TickResult {
  ok: boolean;
  mined?: number;
  vault?: number;
  error?: string;
}

export interface ClaimResult {
  ok: boolean;
  amount?: number;
  error?: string;
}

export interface ChestResult {
  ok: boolean;
  item?: ItemDto;
  error?: string;
}

export interface UpgradeResult {
  ok: boolean;
  cost?: number;
  /** Number of levels actually purchased (bulk stat upgrades buy >1 in one request). */
  levels?: number;
  error?: string;
}

export interface RaidResult {
  ok: boolean;
  success?: boolean;
  stolen?: number;
  xp?: number;
  error?: string;
}

export interface LogDto {
  _id?: string;
  type: string;
  wallet: string;
  target?: string;
  amount?: number;
  seed?: string;
  txHash?: string;
  error?: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

export type TxType = "withdrawal" | "deposit" | "market_purchase";

export interface PendingTxDto {
  id: string;
  type: TxType;
  status: "pending" | "failed" | "dead";
  signature: string;
  amount: number;
  itemNumber: number | null;
  retryCount: number;
  error: string | null;
  refunded: boolean;
  createdAt: number;
}

export interface SettledTxDto {
  id: string;
  type: TxType;
  txHash: string;
  amount: number;
  /** "failed" marks a dead-lettered attempt that never moved funds of its own. */
  status: "success" | "failed";
  error: string | null;
  processedAt: number;
  metadata: Record<string, unknown> | null;
}
