import axios from "axios";
import { HIVE_CONFIG } from "@/lib/config/api";

export const HIVEX_VOTER_ACCOUNT = "hivexph.voter";

export interface EngineStats {
  /** Effective HP controlled by the voter account (own + received - delegated). */
  delegatedHp: number;
  /** Liquid HIVE balance of the voter account. */
  hive: number;
  /** HBD balance of the voter account. */
  hbd: number;
  /** Resource Credit percentage 0-100. */
  rcPct: number;
  /** Pending claimed accounts (ACTs ready to use). */
  actAvailable: number;
  /** Whether the data was sourced from the (yet-to-exist) backend or the public chain fallback. */
  source: "backend" | "chain";
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.split(" ")[0]) || 0;
}

/**
 * Fetch dashboard stats for the HiveX Tools hub.
 *
 * Prefers `POST /api/public/tools/engine-stats` (backend not yet implemented).
 * Falls back to public Hive RPC so the dashboard renders in demo mode.
 */
export async function fetchEngineStats(): Promise<EngineStats> {
  // Backend contract — wired now so it lights up automatically once shipped.
  try {
    const res = await axios.post("/api/public/tools/engine-stats", {}, { timeout: 4000 });
    const d = res.data ?? {};
    if (d && d.ok !== false && typeof d.delegated_hp === "number") {
      return {
        delegatedHp: d.delegated_hp,
        hive: d.hive ?? 0,
        hbd: d.hbd ?? 0,
        rcPct: (d.rc_pct ?? 0) * 100,
        actAvailable: d.act_available ?? 0,
        source: "backend",
      };
    }
  } catch {
    // fall through to chain
  }

  const [accountsRes, gpoRes, rcRes] = await Promise.all([
    axios.post<{
      result: Array<{
        balance: string;
        hbd_balance: string;
        vesting_shares: string;
        received_vesting_shares: string;
        delegated_vesting_shares: string;
        pending_claimed_accounts: number;
      }>;
    }>(HIVE_CONFIG.apiUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "condenser_api.get_accounts",
      params: [[HIVEX_VOTER_ACCOUNT]],
    }),
    axios.post<{
      result: { total_vesting_fund_hive: string; total_vesting_shares: string };
    }>(HIVE_CONFIG.apiUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "condenser_api.get_dynamic_global_properties",
      params: [],
    }),
    axios.post<{
      result: {
        rc_accounts: Array<{
          max_rc: string;
          rc_manabar: { current_mana: string; last_update_time: number };
        }>;
      };
    }>(HIVE_CONFIG.apiUrl, {
      jsonrpc: "2.0",
      id: 3,
      method: "rc_api.find_rc_accounts",
      params: { accounts: [HIVEX_VOTER_ACCOUNT] },
    }),
  ]);

  const acc = accountsRes.data?.result?.[0];
  const gpo = gpoRes.data?.result;
  const rcAcc = rcRes.data?.result?.rc_accounts?.[0];

  const hive = acc ? parseAmount(acc.balance) : 0;
  const hbd = acc ? parseAmount(acc.hbd_balance) : 0;
  const actAvailable = acc?.pending_claimed_accounts ?? 0;

  let delegatedHp = 0;
  if (acc && gpo) {
    const vests =
      parseAmount(acc.vesting_shares) +
      parseAmount(acc.received_vesting_shares) -
      parseAmount(acc.delegated_vesting_shares);
    const fundHive = parseAmount(gpo.total_vesting_fund_hive);
    const totalVests = parseAmount(gpo.total_vesting_shares);
    delegatedHp = totalVests > 0 ? (vests * fundHive) / totalVests : 0;
  }

  let rcPct = 0;
  if (rcAcc) {
    const maxRc = parseFloat(rcAcc.max_rc) || 0;
    const currentMana = parseFloat(rcAcc.rc_manabar.current_mana) || 0;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = Math.max(0, now - (rcAcc.rc_manabar.last_update_time || now));
    const regen = (maxRc * elapsed) / (5 * 24 * 60 * 60);
    const effective = Math.min(maxRc, currentMana + regen);
    rcPct = maxRc > 0 ? (effective / maxRc) * 100 : 0;
  }

  return { delegatedHp, hive, hbd, rcPct, actAvailable, source: "chain" };
}