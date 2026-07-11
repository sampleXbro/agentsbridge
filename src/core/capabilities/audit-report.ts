import type { AuditReport } from './audit.js';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

export function renderAuditReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('GAPS (descriptor < maxAchievable):');
  for (const g of report.gaps) {
    lines.push(`  ${pad(g.target, 16)}${pad(g.feature, 16)}${pad(g.scope, 9)}${g.from}->${g.to}`);
  }
  lines.push('STALE (needs verification):');
  for (const s of report.stale) {
    lines.push(`  ${pad(s.target, 16)}${pad(s.feature, 16)}${pad(s.scope, 9)}${s.reason}`);
  }
  lines.push('MISSING PROVENANCE (native/embedded, no ledger entry):');
  for (const m of report.missing) {
    lines.push(`  ${pad(m.target, 16)}${pad(m.feature, 16)}${pad(m.scope, 9)}${m.level}`);
  }
  lines.push('');
  lines.push(`${report.gaps.length} gaps · ${report.stale.length} stale · ${report.missing.length} missing`);
  return lines.join('\n');
}

/** `--verify`: MISSING provenance for an advertised native/embedded cell is a hard failure. */
export function verifyLedgerCoverage(report: AuditReport): string[] {
  return report.missing.map((m) => `no ledger provenance for ${m.target}/${m.feature} (${m.scope}, ${m.level})`);
}
