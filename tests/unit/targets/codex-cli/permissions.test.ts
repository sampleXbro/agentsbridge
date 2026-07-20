/**
 * Codex CLI permissions generator + importer tests.
 * Native at both project and global scope via `.codex/rules/agentsmesh-permissions.rules`
 * (Starlark `prefix_rule` DSL) — see generator/permissions.ts and importer-permissions.ts.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, ImportResult } from '../../../../src/core/types.js';
import { generatePermissions } from '../../../../src/targets/codex-cli/generator/permissions.js';
import { importCodexPermissions } from '../../../../src/targets/codex-cli/importer-permissions.js';

const TEST_DIR = join(tmpdir(), 'am-codex-permissions-test');

function canonicalWithPermissions(permissions: CanonicalFiles['permissions']): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions,
    hooks: null,
    ignore: [],
  };
}

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('generatePermissions (codex-cli)', () => {
  it('returns [] when permissions is null', () => {
    expect(generatePermissions(canonicalWithPermissions(null))).toEqual([]);
  });

  it('returns [] when allow/deny/ask are all empty', () => {
    expect(generatePermissions(canonicalWithPermissions({ allow: [], deny: [] }))).toEqual([]);
  });

  it('writes .codex/rules/agentsmesh-permissions.rules for allow-only entries', () => {
    const results = generatePermissions(
      canonicalWithPermissions({ allow: ['Bash(git status:*)'], deny: [] }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.codex/rules/agentsmesh-permissions.rules');
    expect(results[0]!.content).toContain('# agentsmesh-permission allow: Bash(git status:*)');
    expect(results[0]!.content).toContain('prefix_rule(');
    expect(results[0]!.content).toContain('pattern = ["git", "status"],');
    expect(results[0]!.content).toContain('decision = "allow",');
  });

  it('maps deny-only entries to decision="forbidden"', () => {
    const results = generatePermissions(
      canonicalWithPermissions({ allow: [], deny: ['Bash(curl:*)'] }),
    );
    expect(results[0]!.content).toContain('# agentsmesh-permission deny: Bash(curl:*)');
    expect(results[0]!.content).toContain('decision = "forbidden",');
  });

  it('maps ask-only entries to decision="prompt"', () => {
    const results = generatePermissions(
      canonicalWithPermissions({ allow: [], deny: [], ask: ['Bash(npm publish:*)'] }),
    );
    expect(results[0]!.content).toContain('# agentsmesh-permission ask: Bash(npm publish:*)');
    expect(results[0]!.content).toContain('decision = "prompt",');
  });

  it('keeps non-Bash entries as informational comments (no false prefix_rule)', () => {
    const results = generatePermissions(canonicalWithPermissions({ allow: ['Read'], deny: [] }));
    expect(results[0]!.content).toContain('# agentsmesh-permission allow: Read');
    expect(results[0]!.content).toContain('no Codex command-execution equivalent');
    expect(results[0]!.content).not.toContain('prefix_rule(\n    pattern = ["Read"');
  });

  it('strips a trailing :* wildcard suffix before tokenizing', () => {
    const results = generatePermissions(
      canonicalWithPermissions({ allow: ['Bash(pnpm run test:*)'], deny: [] }),
    );
    expect(results[0]!.content).toContain('pattern = ["pnpm", "run", "test"],');
  });

  it('tokenizes a Bash pattern with no trailing :* wildcard', () => {
    const results = generatePermissions(
      canonicalWithPermissions({ allow: ['Bash(git status)'], deny: [] }),
    );
    expect(results[0]!.content).toContain('pattern = ["git", "status"],');
  });

  it('treats an empty Bash command (only a :* wildcard) as having no equivalent', () => {
    const results = generatePermissions(
      canonicalWithPermissions({ allow: ['Bash(:*)'], deny: [] }),
    );
    expect(results[0]!.content).toContain('# agentsmesh-permission allow: Bash(:*)');
    expect(results[0]!.content).toContain('no Codex command-execution equivalent');
  });
});

describe('importCodexPermissions', () => {
  it('does nothing when the permissions rules file is absent', async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const results: ImportResult[] = [];
    await importCodexPermissions(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('does nothing when the rules file exists but has no agentsmesh-permission markers', async () => {
    mkdirSync(join(TEST_DIR, '.codex', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.codex', 'rules', 'agentsmesh-permissions.rules'),
      '# a hand-authored rule with no agentsmesh markers\nprefix_rule(pattern = ["ls"], decision = "allow")\n',
    );
    const results: ImportResult[] = [];
    await importCodexPermissions(TEST_DIR, results);
    expect(results).toEqual([]);
  });

  it('imports allow/deny/ask markers back into canonical permissions.yaml', async () => {
    mkdirSync(join(TEST_DIR, '.codex', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.codex', 'rules', 'agentsmesh-permissions.rules'),
      [
        '# agentsmesh-permission allow: Bash(git status:*)',
        'prefix_rule(',
        '    pattern = ["git", "status"],',
        '    decision = "allow",',
        ')',
        '',
        '# agentsmesh-permission deny: Bash(curl:*)',
        'prefix_rule(',
        '    pattern = ["curl"],',
        '    decision = "forbidden",',
        ')',
        '',
        '# agentsmesh-permission ask: Bash(npm publish:*)',
        'prefix_rule(',
        '    pattern = ["npm", "publish"],',
        '    decision = "prompt",',
        ')',
      ].join('\n'),
    );

    const results: ImportResult[] = [];
    await importCodexPermissions(TEST_DIR, results);

    expect(results).toHaveLength(1);
    expect(results[0]!.toPath).toBe('.agentsmesh/permissions.yaml');
    const parsed = parseYaml(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8'),
    ) as { allow: string[]; deny: string[]; ask: string[] };
    expect(parsed.allow).toEqual(['Bash(git status:*)']);
    expect(parsed.deny).toEqual(['Bash(curl:*)']);
    expect(parsed.ask).toEqual(['Bash(npm publish:*)']);
  });

  it('recovers non-Bash entries from their marker comment (no prefix_rule needed)', async () => {
    mkdirSync(join(TEST_DIR, '.codex', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.codex', 'rules', 'agentsmesh-permissions.rules'),
      [
        '# agentsmesh-permission allow: Read',
        '# agentsmesh: no Codex command-execution equivalent for "Read" (informational only)',
      ].join('\n'),
    );
    const results: ImportResult[] = [];
    await importCodexPermissions(TEST_DIR, results);
    const parsed = parseYaml(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8'),
    ) as { allow: string[] };
    expect(parsed.allow).toEqual(['Read']);
  });

  it('round-trips generate -> import back to the original canonical permissions', async () => {
    const canonical = canonicalWithPermissions({
      allow: ['Bash(pnpm build:*)'],
      deny: ['Bash(curl:*)', 'Read(./.env)'],
      ask: ['WebFetch'],
    });
    const generated = generatePermissions(canonical);
    mkdirSync(join(TEST_DIR, '.codex', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, generated[0]!.path), generated[0]!.content);

    const results: ImportResult[] = [];
    await importCodexPermissions(TEST_DIR, results);
    const parsed = parseYaml(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'permissions.yaml'), 'utf-8'),
    ) as { allow: string[]; deny: string[]; ask: string[] };
    expect(parsed.allow).toEqual(['Bash(pnpm build:*)']);
    expect(parsed.deny).toEqual(['Bash(curl:*)', 'Read(./.env)']);
    expect(parsed.ask).toEqual(['WebFetch']);
  });
});
