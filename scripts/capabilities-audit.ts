/**
 * Deterministic capability audit over descriptors × the capability ledger.
 * Usage:
 *   pnpm capabilities:audit                 # human table (gaps/stale/missing)
 *   pnpm capabilities:audit --json          # machine-readable report
 *   pnpm capabilities:audit --stale 90      # override staleness window (days)
 *   pnpm capabilities:verify                # non-zero if any native/embedded cell lacks provenance
 */
import { loadCapabilityLedger } from '../src/core/capabilities/ledger.js';
import { auditCapabilities } from '../src/core/capabilities/audit.js';
import {
  renderAuditReport,
  verifyLedgerCoverage,
  verifyLedgerIntegrity,
} from '../src/core/capabilities/audit-report.js';
import { TARGET_IDS } from '../src/targets/catalog/target-ids.js';

function flagValue(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const parsed = Number.parseInt(process.argv[idx + 1], 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const today = new Date().toISOString().slice(0, 10);
const staleDays = flagValue('--stale', 180);
const ledger = loadCapabilityLedger();
const report = auditCapabilities({ ledger, today, staleDays });

if (process.argv.includes('--verify')) {
  const problems = [...verifyLedgerIntegrity(ledger, [...TARGET_IDS]), ...verifyLedgerCoverage(report)];
  if (problems.length > 0) {
    process.stderr.write(`capabilities:verify failed:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('capabilities:verify OK\n');
} else if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${renderAuditReport(report)}\n`);
}
