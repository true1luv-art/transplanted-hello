/**
 * Backend infrastructure diagnostics.
 *
 * Reports the health of MongoDB, Hive and the configuration in a form that is
 * safe to expose: presence flags only. Private keys, active keys, passwords
 * and connection strings are never included.
 *
 * SERVER-ONLY.
 */
import { checkHiveAccount, checkHiveConnection, isBroadcastConfigured } from "@/lib/chain/hive";
import type { HiveAccountStatus, HiveConnectionStatus } from "@/lib/chain/types";
import { config, getConfigDiagnostics, type ConfigDiagnostics } from "@/lib/config/config";
import { checkDatabaseConnection, type DatabaseStatus } from "@/lib/config/database";

export interface BackendDiagnostics {
  ok: boolean;
  nodeEnv: string;
  configuration: ConfigDiagnostics;
  database: DatabaseStatus;
  blockchain: {
    driver: "mock" | "hive";
    mock: boolean;
    /** presence only — the key itself is never exposed */
    signingConfigured: boolean;
    broadcastEnabled: boolean;
    hive?: HiveConnectionStatus | undefined;
    account?: HiveAccountStatus | undefined;
  };
}

/**
 * Collects infrastructure status. Hive is only probed when the real driver is
 * selected (or `probeHive` is forced), so mock development never needs network.
 */
export async function collectDiagnostics(
  options: { probeHive?: boolean } = {},
): Promise<BackendDiagnostics> {
  const configuration = getConfigDiagnostics();
  const database = await checkDatabaseConnection();
  const probeHive = options.probeHive ?? config.blockchainDriver === "hive";

  const blockchain: BackendDiagnostics["blockchain"] = {
    driver: config.blockchainDriver,
    mock: config.blockchainDriver === "mock",
    signingConfigured: isBroadcastConfigured(),
    broadcastEnabled: config.hive.broadcastEnabled,
  };

  if (probeHive) {
    const [hive, account] = await Promise.all([checkHiveConnection(), checkHiveAccount()]);
    blockchain.hive = hive;
    blockchain.account = account;
  }

  const hiveOk = !probeHive || (blockchain.hive?.connected ?? false);
  return {
    ok: configuration.valid && database.connected && hiveOk,
    nodeEnv: config.nodeEnv,
    configuration,
    database,
    blockchain,
  };
}
