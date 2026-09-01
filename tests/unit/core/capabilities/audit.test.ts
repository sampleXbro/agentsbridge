import { describe, expect, it } from 'vitest';
import { auditCapabilities } from '../../../../src/core/capabilities/audit.js';
import type {
  CapabilityLedger,
  LedgerCell,
} from '../../../../src/core/capabilities/ledger-types.js';

function cell(over: Partial<LedgerCell>): LedgerCell {
  return {
    target: 'claude-code',
    feature: 'mcp',
    scope: 'project',
    maxAchievable: 'native',
    path: '.mcp.json',
    ext: '.json',
    format: 'json',
    fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    source: [],
    verifiedAt: '2026-01-01',
    verdict: 'confirmed',
    rejectionReason: null,
    ...over,
  };
}

const TODAY = '2026-07-11';

describe('auditCapabilities', () => {
  it('flags exactly one GAP when descriptor is below maxAchievable', () => {
    // zed has no user-definable subagents, so the descriptor is 'none'; a native
    // ceiling makes it a gap. (This used aider/hooks until aider/hooks went native.)
    const ledger: CapabilityLedger = {
      cells: [
        cell({ target: 'zed', feature: 'agents', maxAchievable: 'native', verifiedAt: TODAY }),
      ],
    };
    const report = auditCapabilities({
      ledger,
      today: TODAY,
      staleDays: 180,
      targetIds: ['zed'],
    });
    expect(report.gaps).toHaveLength(1);
    expect(report.gaps[0]).toMatchObject({
      target: 'zed',
      feature: 'agents',
      scope: 'project',
      from: 'none',
      to: 'native',
    });
    expect(report.stale).toEqual([]);
  });

  it('flags exactly one STALE (unverified) when verifiedAt is null', () => {
    const ledger: CapabilityLedger = { cells: [cell({ verifiedAt: null, verdict: 'unverified' })] };
    const report = auditCapabilities({
      ledger,
      today: TODAY,
      staleDays: 180,
      targetIds: ['claude-code'],
    });
    expect(report.stale).toHaveLength(1);
    expect(report.stale[0]).toMatchObject({
      target: 'claude-code',
      feature: 'mcp',
      scope: 'project',
      reason: 'unverified',
      verifiedAt: null,
    });
  });

  it('flags exactly one STALE (expired) when older than the threshold', () => {
    const ledger: CapabilityLedger = { cells: [cell({ verifiedAt: '2025-01-01' })] };
    const report = auditCapabilities({
      ledger,
      today: TODAY,
      staleDays: 180,
      targetIds: ['claude-code'],
    });
    expect(report.stale).toHaveLength(1);
    expect(report.stale[0]).toMatchObject({
      target: 'claude-code',
      feature: 'mcp',
      scope: 'project',
      reason: 'expired',
      verifiedAt: '2025-01-01',
    });
  });

  it('flags STALE (over-declared) when the descriptor exceeds maxAchievable', () => {
    // claude-code/rules/project is `native`; a ledger cell capping it at `partial` is an over-declaration.
    const ledger: CapabilityLedger = {
      cells: [cell({ feature: 'rules', maxAchievable: 'partial', verifiedAt: TODAY })],
    };
    const report = auditCapabilities({
      ledger,
      today: TODAY,
      staleDays: 180,
      targetIds: ['claude-code'],
    });
    expect(report.stale).toHaveLength(1);
    expect(report.stale[0]).toMatchObject({
      target: 'claude-code',
      feature: 'rules',
      scope: 'project',
      reason: 'over-declared',
    });
    expect(report.gaps).toEqual([]);
  });

  it('flags MISSING for a native/embedded descriptor cell with no ledger entry', () => {
    const report = auditCapabilities({
      ledger: { cells: [] },
      today: TODAY,
      staleDays: 180,
      targetIds: ['claude-code'],
    });
    expect(
      report.missing.some(
        (m) => m.target === 'claude-code' && m.feature === 'rules' && m.scope === 'project',
      ),
    ).toBe(true);
  });

  it('only ever reports native/embedded cells as MISSING', () => {
    const report = auditCapabilities({
      ledger: { cells: [] },
      today: TODAY,
      staleDays: 180,
      targetIds: ['claude-code'],
    });
    expect(report.missing.every((m) => m.level === 'native' || m.level === 'embedded')).toBe(true);
  });

  it('reports over-declared independently from unverified — both appear when verifiedAt is null AND descriptor exceeds maxAchievable', () => {
    // claude-code/rules/project descriptor = native; ledger cell caps at partial → over-declared.
    // verifiedAt is null → also unverified.
    // Both reasons MUST appear in the stale bucket (not masked by else-if).
    const ledger: CapabilityLedger = {
      cells: [
        cell({
          feature: 'rules',
          maxAchievable: 'partial',
          verifiedAt: null,
          verdict: 'unverified',
        }),
      ],
    };
    const report = auditCapabilities({
      ledger,
      today: TODAY,
      staleDays: 180,
      targetIds: ['claude-code'],
    });
    const reasons = report.stale
      .filter((s) => s.target === 'claude-code' && s.feature === 'rules' && s.scope === 'project')
      .map((s) => s.reason);
    expect(reasons).toContain('unverified');
    expect(reasons).toContain('over-declared');
  });
});
