/**
 * Backend connectivity check.
 *
 *   npm run backend:check          # config + database (+ Hive when driver=hive)
 *   npm run backend:check -- --hive  # always probe Hive
 *
 * Read-only: it never broadcasts a transaction and never prints secrets.
 */
import { config } from "@/lib/config/config";
import { closeDatabase } from "@/lib/config/database";
import { collectDiagnostics } from "@/server/api/lib/diagnostics";

function line(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✓" : "✗"} ${label.padEnd(14)} ${detail}`);
}

async function main() {
  const probeHive = process.argv.includes("--hive") || config.blockchainDriver === "hive";
  const d = await collectDiagnostics({ probeHive });

  console.log(`HiveMint backend check (${d.nodeEnv})\n`);

  line(
    "Configuration",
    d.configuration.valid,
    d.configuration.valid ? "valid" : `${d.configuration.issues.length} issue(s)`,
  );
  for (const issue of d.configuration.issues) {
    console.log(`   [${issue.level}] ${issue.key}: ${issue.message}`);
  }

  line(
    "Database",
    d.database.connected,
    d.database.connected
      ? `connected (driver=${d.database.driver}, db=${d.database.name})`
      : (d.database.error ?? "not connected"),
  );

  line(
    "Blockchain",
    true,
    `driver=${d.blockchain.driver}, signing=${d.blockchain.signingConfigured ? "configured" : "off"}`,
  );

  if (d.blockchain.hive) {
    const h = d.blockchain.hive;
    line(
      "Hive RPC",
      h.connected,
      h.connected
        ? `${h.node} head=${h.headBlock} (${h.latencyMs}ms, ${h.network})`
        : (h.error ?? "unreachable"),
    );
  }
  if (d.blockchain.account) {
    const a = d.blockchain.account;
    line(
      "Hive account",
      a.exists,
      a.configured
        ? `@${a.account} ${a.exists ? "found" : (a.error ?? "not found")}`
        : "not configured",
    );
  }

  console.log(`\n${d.ok ? "Backend ready." : "Backend NOT ready — see the items above."}`);
  await closeDatabase();
  process.exit(d.ok ? 0 : 1);
}

void main().catch((error) => {
  console.error("Backend check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
