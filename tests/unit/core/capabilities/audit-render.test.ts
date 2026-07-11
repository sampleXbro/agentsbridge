import { describe, expect, it } from 'vitest';
import { renderAuditReport, verifyLedgerCoverage } from '../../../../src/core/capabilities/audit-report.js';
import type { AuditReport } from '../../../../src/core/capabilities/audit.js';

const EMPTY: AuditReport = { gaps: [], stale: [], missing: [] };

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
