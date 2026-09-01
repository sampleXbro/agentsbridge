/** Defensive branches that the happy-path suites do not reach. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';
import { generateCommands } from '../../../../src/targets/openhands/generator.js';
import { lintRules } from '../../../../src/targets/openhands/linter.js';
import { remapOpenhandsRuleFrontmatter } from '../../../../src/targets/openhands/rules-format.js';
import { importFromOpenhands } from '../../../../src/targets/openhands/importer.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

function makeRule(slug: string, overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: `.agentsmesh/rules/${slug}.md`,
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: `# ${slug}`,
    ...overrides,
  };
}

let dir = '';

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-openhands-branch-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('generateCommands with no description', () => {
  it('writes a frontmatter-free command file', () => {
    const outputs = generateCommands(
      makeCanonical({
        commands: [
          {
            source: '.agentsmesh/commands/raw.md',
            name: 'raw',
            description: '',
            allowedTools: [],
            body: 'Just do it.',
          },
        ],
      }),
    );
    expect(outputs[0]!.content).toBe('Just do it.');
  });
});

describe('lintUnscopedRules target filter', () => {
  it('ignores a globless rule aimed at a different tool', () => {
    const messages = lintRules(
      makeCanonical({
        rules: [makeRule('_root', { root: true }), makeRule('other', { targets: ['claude-code'] })],
      }),
      dir,
      [],
    ).map((d) => d.message);
    expect(messages.some((m) => m.includes('"other"'))).toBe(false);
  });
});

describe('remapOpenhandsRuleFrontmatter', () => {
  it('drops the paths key entirely when it holds nothing usable', () => {
    expect(remapOpenhandsRuleFrontmatter({ description: 'x', paths: 42 })).toEqual({
      description: 'x',
    });
  });
});

describe('hooks import resilience', () => {
  it('skips an unparsable .openhands/hooks.json instead of writing canonical hooks', async () => {
    write('.openhands/hooks.json', '{ not json');
    expect(await importFromOpenhands(dir)).toEqual([]);
  });

  it('skips a hooks file whose events are all unknown', async () => {
    write('.openhands/hooks.json', JSON.stringify({ unknown_event: [] }));
    expect(await importFromOpenhands(dir)).toEqual([]);
  });

  it('imports a hooks file that also carries an unknown event', async () => {
    write(
      '.openhands/hooks.json',
      JSON.stringify({
        unknown_event: [],
        session_end: [{ matcher: '*', hooks: [{ type: 'command', command: 'bye' }] }],
      }),
    );
    await importFromOpenhands(dir);
    expect(readFileSync(join(dir, '.agentsmesh/hooks.yaml'), 'utf-8')).toContain('SessionEnd');
  });
});
