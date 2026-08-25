import { STAT_KEYS } from "@/features/constants/game";
import type { ItemDto } from "@/lib/api/types";
import type { Equipment, Rarity, SlotKey, StatRoll } from "@/features/types/game";

/**
 * Maps a server-minted item (the DB row returned by /api/game/chest,
 * /api/items, etc.) into the client's local Equipment shape so it can be
 * displayed and cached in the equipment store. The server is always the
 * source of truth here — this is a pure display-layer conversion, never a
 * substitute for minting.
 */
export function itemDtoToEquipment(item: ItemDto | Record<string, unknown>): Equipment {
  const dto = item as ItemDto;
  const rawStats = (dto.stats ?? {}) as Record<string, number>;

  // Server rolls store all six stat keys with 0 for unset ones; local
  // Equipment.stats is a sparse StatRoll (only the rolled keys present).
  const stats: StatRoll = {};
  for (const key of STAT_KEYS) {
    const value = rawStats[key];
    if (value) stats[key] = value;
  }

  return {
    id: String(dto.itemNumber),
    name: dto.name,
    slot: dto.slot as SlotKey,
    rarity: dto.rarity as Rarity,
    stats,
    level: dto.level,
    equipped: dto.equipped,
    createdAt: dto.createdAt,
  };
}
