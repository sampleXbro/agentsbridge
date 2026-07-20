import { describe, expect, it } from 'vitest';
import {
  renderAuditReport,
  verifyLedgerCoverage,
  verifyLedgerIntegrity,
} from '../../../../src/core/capabilities/audit-report.js';
import type { AuditReport } from '../../../../src/core/capabilities/audit.js';
import type { CapabilityLedger, LedgerCell } from '../../../../src/core/capabilities/ledger-types.js';

const EMPTY: AuditReport = { gaps: [], stale: [], missing: [] };

function ledgerCell(over: Partial<LedgerCell> = {}): LedgerCell {
  return {
    target: 'claude-code', feature: 'mcp', scope: 'project', maxAchievable: 'native',
    path: '.mcp.json', ext: '.json', format: 'json',
    fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    source: [], verifiedAt: null, verdict: 'unverified', rejectionReason: null, ...over,
  };
}

describe('renderAuditReport', () => {
  it('renders a clean report', () => {
    expect(renderAuditReport(EMPTY)).toMatch(/0 gaps.*0 stale.*0 missing/s);
  });
  it('lists a gap row', () => {
    const report: AuditReport = { ...EMPTY, gaps: [{ target: 'aider', feature: 'hooks', scope: 'project', from: 'none', to: 'native', source: [] }] };
    expect(renderAuditReport(report)).toMatch(/aider\s+hooks\s+project\s+none->native/);
  });
});

describe('verifyLedgerCoverage', () => {
  it('reports missing coverage as a problem', () => {
    const problems = verifyLedgerCoverage({ gaps: [], stale: [], missing: [{ target: 'claude-code', feature: 'rules', scope: 'project', level: 'native' }] });
    expect(problems.some((p) => /claude-code\/rules/.test(p))).toBe(true);
  });
  it('passes when nothing is missing', () => {
    expect(verifyLedgerCoverage(EMPTY)).toEqual([]);
  });
});

describe('verifyLedgerIntegrity', () => {
  const known = ['claude-code', 'cline'];

  it('accepts a ledger of valid, unique cells', () => {
    const ledger: CapabilityLedger = { cells: [ledgerCell(), ledgerCell({ target: 'cline' })] };
    expect(verifyLedgerIntegrity(ledger, known)).toEqual([]);
  });

  it('flags an unknown target', () => {
    const ledger: CapabilityLedger = { cells: [ledgerCell({ target: 'not-a-target' })] };
    expect(verifyLedgerIntegrity(ledger, known).some((p) => /unknown target "not-a-target"/.test(p))).toBe(true);
  });

  it('flags an unknown feature (a loader cast that slipped through)', () => {
    const ledger: CapabilityLedger = { cells: [ledgerCell({ feature: 'mcps' as LedgerCell['feature'] })] };
    expect(verifyLedgerIntegrity(ledger, known).some((p) => /unknown feature "mcps"/.test(p))).toBe(true);
  });

  it('flags a duplicate cell', () => {
    const ledger: CapabilityLedger = { cells: [ledgerCell(), ledgerCell()] };
    expect(verifyLedgerIntegrity(ledger, known)).toEqual(['duplicate cell claude-code::mcp::project']);
  });
});
