import { formatHash } from "@/lib/format";
import { RARITY_META, STAT_META } from "@/features/constants/game";
import type { LogDto } from "@/lib/api/types";
import type { ActivityEntry, Rarity, StatKey } from "@/features/types/game";

const num = (value: unknown): number => (typeof value === "number" ? value : 0);
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export type MarketAction = "bought" | "sold" | "listed" | "cancelled";

export interface MarketLogRow {
  id: string;
  action: MarketAction | string;
  /** "item" for equipment, "asset" for cosmetic NFTs, undefined for legacy logs. */
  kind: "item" | "asset" | undefined;
  refId: number;
  /** Legacy alias for refId — kept for backward compat. */
  itemNumber: number;
  name: string;
  rarity?: string | undefined;
  price: number;
  fee: number;
  counterparty?: string | undefined;
  wallet: string;
  at: number;
}

export function toMarketRow(log: LogDto, index: number): MarketLogRow {
  const data = log.data ?? {};
  // Derive kind: prefer data.kind, then fall back to log type suffix
  let kind: "item" | "asset" | undefined;
  const dataKind = str(data["kind"]);
  if (dataKind === "item" || dataKind === "asset") {
    kind = dataKind;
  } else if (log.type === "market_item") {
    kind = "item";
  } else if (log.type === "market_asset") {
    kind = "asset";
  }

  const refId = num(data["refId"]) || num(data["itemNumber"]);
  const defaultName = kind === "asset" ? `Asset #${refId}` : `Item #${refId}`;

  return {
    id: log._id ?? `${log.createdAt}-${index}`,
    action: str(data["action"]) ?? "trade",
    kind,
    refId,
    itemNumber: refId, // backward compat
    name: str(data["name"]) ?? defaultName,
    rarity: str(data["rarity"]),
    price: num(data["price"]),
    fee: num(data["fee"]),
    counterparty: log.target,
    wallet: log.wallet,
    at: log.createdAt,
  };
}

export function marketLogMessage(row: MarketLogRow): string {
  const price = `${formatHash(row.price)} HASH`;
  const label = row.kind === "asset" ? "asset" : "item";
  if (row.action === "bought") return `Bought ${row.name} for ${price}`;
  if (row.action === "sold") return `Sold ${row.name} for ${price}`;
  if (row.action === "listed") return `Listed ${label} ${row.name} for ${price}`;
  if (row.action === "cancelled") return `Cancelled listing for ${row.name}`;
  return `${row.name} — ${price}`;
}

/** Turns a server gameplay log into an activity-feed entry. */
export function toActivityEntry(log: LogDto, index: number): ActivityEntry {
  const data = log.data ?? {};
  const amount = log.amount ?? 0;
  let message: string;
  let kind: ActivityEntry["kind"] = "info";
  let parts: ActivityEntry["parts"];

  switch (log.type) {
    case "claim":
      message = `Claimed ${formatHash(amount)} HASH from the vault`;
      kind = "success";
      break;
    case "mining":
      message = `Mined ${formatHash(amount)} HASH`;
      break;
    case "chest": {
      const gearName = str(data["name"]) ?? "new gear";
      const rarity = str(data["rarity"]) as Rarity | undefined;
      message = `Opened a chest and found ${gearName}`;
      kind = "loot";
      parts = [
        { text: "Opened a chest and found " },
        { text: gearName, className: rarity ? RARITY_META[rarity].textClass : undefined },
      ];
      break;
    }
    case "burn":
      message = `Committed ${formatHash(Math.abs(amount))} HASH to Notoriety`;
      kind = "danger";
      break;
    case "raid": {
      const won = data["success"] === true;
      message = won
        ? `Raid on ${log.target ?? "a rival"} succeeded — stole ${formatHash(Math.abs(amount))} HASH`
        : `Raid on ${log.target ?? "a rival"} failed`;
      kind = won ? "success" : "danger";
      break;
    }
    case "salvage":
      message = `Salvaged ${str(data["name"]) ?? "an item"} for ${formatHash(amount)} SPARKS`;
      kind = "info";
      break;
    case "vault": {
      const event = str(data["event"]);
      if (event === "stake") {
        const staked = num(data["vaultStakedGain"]) || Math.abs(amount);
        message = `Staked ${formatHash(staked)} HASH to vault size`;
      } else {
        message = `Mined ${formatHash(num(data["mined"]) || amount)} HASH into the vault`;
      }
      kind = "success";
      break;
    }
    case "stat_upgrade": {
      const statKey = str(data["stat"]) as StatKey | undefined;
      const statLabel = statKey ? STAT_META[statKey].label : "a stat";
      const from = num(data["from"]);
      const to = num(data["to"]);
      message = `Upgraded ${statLabel} level ${from} to ${to}`;
      kind = "success";
      break;
    }
    case "upgrade": {
      const itemName = str(data["name"]) ?? "an item";
      const from = num(data["from"]);
      const to = num(data["to"]);
      message = `Upgraded ${itemName} level ${from} to ${to}`;
      kind = "success";
      break;
    }
    case "shop": {
      const cosmeticName = str(data["name"]) ?? "a cosmetic";
      const cosmeticKind = str(data["kind"]);
      const label = cosmeticKind
        ? `${cosmeticKind.charAt(0).toUpperCase()}${cosmeticKind.slice(1)}`
        : "Cosmetic";
      message = `Purchased ${label.toLowerCase()} ${cosmeticName} for ${formatHash(Math.abs(amount))} HASH`;
      kind = "success";
      parts = [
        { text: `Purchased ${label.toLowerCase()} ` },
        { text: cosmeticName },
        { text: ` for ${formatHash(Math.abs(amount))} HASH` },
      ];
      break;
    }
    default:
      message = str(data["message"]) ?? log.type;
  }

  return { id: log._id ?? `${log.createdAt}-${index}`, message, kind, at: log.createdAt, parts };
}
