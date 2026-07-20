import { describe, expect, it } from 'vitest';
import { parseCapabilityLedger } from '../../../../src/core/capabilities/ledger.js';

const VALID = JSON.stringify({
  cells: [
    {
      target: 'cline',
      feature: 'mcp',
      scope: 'project',
      maxAchievable: 'native',
      path: '.cline/mcp.json',
      ext: '.json',
      format: 'json',
      fingerprint: { topLevelKeys: ['mcpServers'], requiredFrontmatter: [], keyChecks: [] },
      source: ['https://docs.cline.bot/mcp'],
      verifiedAt: '2026-05-01',
      verdict: 'confirmed',
      rejectionReason: null,
    },
  ],
});

describe('parseCapabilityLedger', () => {
  it('parses a valid ledger', () => {
    const ledger = parseCapabilityLedger(VALID);
    expect(ledger.cells).toHaveLength(1);
    expect(ledger.cells[0].feature).toBe('mcp');
  });

  it('accepts an empty ledger', () => {
    expect(parseCapabilityLedger('{"cells":[]}').cells).toEqual([]);
  });

  it('rejects a non-array cells field', () => {
    expect(() => parseCapabilityLedger('{"cells":{}}')).toThrow(/expected \{ cells/);
  });

  it('rejects a cell missing required fields', () => {
    expect(() => parseCapabilityLedger('{"cells":[{"target":"x"}]}')).toThrow(/cell\[0\]/);
  });

  it('accepts format="text" for plain-text cells', () => {
    const ledger = parseCapabilityLedger(
      JSON.stringify({
        cells: [
          {
            target: 'cline',
            feature: 'hooks',
            scope: 'project',
            maxAchievable: 'native',
            path: '.cline/hooks/posttooluse-0.sh',
            ext: '.sh',
            format: 'text',
            fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
            source: [],
            verifiedAt: null,
            verdict: 'confirmed',
            rejectionReason: null,
          },
        ],
      }),
    );
    expect(ledger.cells[0].format).toBe('text');
  });

  it('rejects an unknown format value', () => {
    expect(() =>
      parseCapabilityLedger(
        JSON.stringify({
          cells: [
            {
              target: 'cline',
              feature: 'hooks',
              scope: 'project',
              maxAchievable: 'native',
              path: '.cline/hooks/posttooluse-0.sh',
              ext: '.sh',
              format: 'unknown-format',
              fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
              source: [],
              verifiedAt: null,
              verdict: 'confirmed',
              rejectionReason: null,
            },
          ],
        }),
      ),
    ).toThrow(/bad format/);
  });
});
