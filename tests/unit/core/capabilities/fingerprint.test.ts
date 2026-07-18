import { describe, expect, it } from 'vitest';
import {
  checkConformance,
  deriveFingerprint,
  parseByFormat,
} from '../../../../src/core/capabilities/fingerprint.js';
import type { LedgerCell } from '../../../../src/core/capabilities/ledger-types.js';

function mcpCell(over: Partial<LedgerCell> = {}): LedgerCell {
  return {
    target: 'cline',
    feature: 'mcp',
    scope: 'project',
    maxAchievable: 'native',
    path: '.cline/mcp.json',
    ext: '.json',
    format: 'json',
    fingerprint: {
      topLevelKeys: ['mcpServers'],
      requiredFrontmatter: [],
      keyChecks: [
        { pointer: '/mcpServers', kind: 'object' },
        { pointer: '/mcpServers/*', kind: 'object', anyOf: ['command', 'url'] },
      ],
    },
    source: [],
    verifiedAt: null,
    verdict: 'unverified',
    rejectionReason: null,
    ...over,
  };
}

describe('parseByFormat', () => {
  it('parses json / yaml / toml', () => {
    expect(parseByFormat('{"a":1}', 'json')).toEqual({ a: 1 });
    expect(parseByFormat('a: 1', 'yaml')).toEqual({ a: 1 });
    expect(parseByFormat('a = 1', 'toml')).toEqual({ a: 1 });
  });
  it('parses md-frontmatter into its frontmatter object', () => {
    expect(parseByFormat('---\nname: x\n---\nbody', 'md-frontmatter')).toEqual({ name: 'x' });
  });
});

describe('checkConformance', () => {
  const raw = JSON.stringify({ mcpServers: { fs: { command: 'node' } } });

  it('returns no issues for conforming content', () => {
    expect(checkConformance(mcpCell(), '.json', raw)).toEqual([]);
  });
  it('flags a wrong extension', () => {
    expect(checkConformance(mcpCell(), '.yaml', raw)[0]).toMatch(/extension/);
  });
  it('flags a missing top-level key', () => {
    const bad = JSON.stringify({ servers: {} });
    expect(
      checkConformance(mcpCell(), '.json', bad).some((i) => /top-level key "mcpServers"/.test(i)),
    ).toBe(true);
  });
  it('flags a keyCheck kind mismatch', () => {
    const bad = JSON.stringify({ mcpServers: [] });
    expect(
      checkConformance(mcpCell(), '.json', bad).some((i) => /\/mcpServers.*object/.test(i)),
    ).toBe(true);
  });
  it('flags a missing anyOf child', () => {
    const bad = JSON.stringify({ mcpServers: { fs: { foo: 1 } } });
    expect(checkConformance(mcpCell(), '.json', bad).some((i) => /command.*url/.test(i))).toBe(
      true,
    );
  });
  it('flags unparseable content', () => {
    expect(checkConformance(mcpCell(), '.json', 'not json')[0]).toMatch(/parse/);
  });
  it('flags a yaml parse failure via the shared catch', () => {
    const cell = mcpCell({
      ext: '.yaml',
      format: 'yaml',
      fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    });
    expect(checkConformance(cell, '.yaml', '{')[0]).toMatch(/failed to parse as yaml/);
  });
  it('flags a missing required frontmatter field (md-frontmatter)', () => {
    const cell = mcpCell({
      ext: '.md',
      format: 'md-frontmatter',
      fingerprint: { topLevelKeys: [], requiredFrontmatter: ['name'], keyChecks: [] },
    });
    const issues = checkConformance(cell, '.md', '---\ndescription: hi\n---\nbody');
    expect(issues).toEqual(['missing frontmatter field "name"']);
  });
  it('passes an anyOf check whose wildcard iterates an array container', () => {
    const cell = mcpCell({
      fingerprint: {
        topLevelKeys: ['servers'],
        requiredFrontmatter: [],
        keyChecks: [{ pointer: '/servers/*', kind: 'object', anyOf: ['url'] }],
      },
    });
    expect(checkConformance(cell, '.json', JSON.stringify({ servers: [{ url: 'x' }] }))).toEqual(
      [],
    );
  });
});

describe('deriveFingerprint', () => {
  it('captures observed top-level keys', () => {
    const fp = deriveFingerprint({ mcpServers: {} }, 'json');
    expect(fp.topLevelKeys).toEqual(['mcpServers']);
  });
  it('returns no keys for a non-record parse result', () => {
    expect(deriveFingerprint([], 'json').topLevelKeys).toEqual([]);
  });
});

describe('text format', () => {
  function textCell(over: Partial<LedgerCell> = {}): LedgerCell {
    return {
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
      ...over,
    };
  }

  it('parseByFormat returns the raw string for text format', () => {
    const raw = '#!/usr/bin/env bash\nset -euo pipefail\n';
    expect(parseByFormat(raw, 'text')).toBe(raw);
  });

  it('checkConformance passes for correct extension with text format', () => {
    const issues = checkConformance(textCell(), '.sh', '#!/usr/bin/env bash\n');
    expect(issues).toEqual([]);
  });

  it('checkConformance flags wrong extension for text format', () => {
    const issues = checkConformance(textCell(), '.yaml', '#!/usr/bin/env bash\n');
    expect(issues[0]).toMatch(/extension/);
  });

  it('checkConformance skips structural fingerprint checks for text format', () => {
    // structural checks (topLevelKeys, requiredFrontmatter, keyChecks) are ignored
    const cell = textCell({
      fingerprint: {
        topLevelKeys: ['someKey'],
        requiredFrontmatter: ['required'],
        keyChecks: [{ pointer: '/foo', kind: 'object' }],
      },
    });
    const issues = checkConformance(cell, '.sh', '#!/usr/bin/env bash\n');
    expect(issues).toEqual([]);
  });

  it('checkConformance allows text cells with empty-string ext (gitignore-style files)', () => {
    const ignoreCell = textCell({ path: '.clineignore', ext: '', format: 'text' });
    const issues = checkConformance(ignoreCell, '', 'node_modules\ndist\n');
    expect(issues).toEqual([]);
  });
});
