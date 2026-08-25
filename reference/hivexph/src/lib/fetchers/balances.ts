import axios from "axios";
import { HIVE_ENGINE_CONFIG } from "@/lib/config/api";

const HE_RPC = HIVE_ENGINE_CONFIG.rpcUrl;

/** Fetch a single HE token balance for an account. */
export async function fetchTokenBalance(
  username: string,
  symbol: string,
): Promise<number> {
  if (!username || !symbol) return 0;
  const res = await axios.post<{ result: Array<{ balance: string }> }>(HE_RPC, {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "find",
    params: {
      contract: "tokens",
      table: "balances",
      query: { account: username, symbol },
      limit: 1,
      offset: 0,
      indexes: [],
    },
  });
  const row = res.data?.result?.[0];
  return row ? parseFloat(row.balance) || 0 : 0;
}
