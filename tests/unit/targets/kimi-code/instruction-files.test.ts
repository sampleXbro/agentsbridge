/**
 * Kimi Code concatenates every instruction file it finds — `.kimi-code/AGENTS.md`
 * **and** the first of `AGENTS.md`/`agents.md` per directory, plus the two user
 * files (`loadAgentsMdForRoots` in `agent-core-v2/src/agent/profile/context.ts`).
 * Import must read them all, and generation must evict the one it does not write.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { importFromKimiCode } from '../../../../src/targets/kimi-code/importer.js';

const CONFIG = 'version: 1\ntargets: [kimi-code]\nfeatures: [rules]\n';
const created: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'kimi-instr-'));
  created.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf-8');
}

describe('project instruction files', () => {
  it('imports both files Kimi Code concatenates, in its own read order', async () => {
    const root = project({
      '.kimi-code/AGENTS.md': '# Nested\n\nNever drop a column in the same release.\n',
      'AGENTS.md': '# Shared\n\nUse TDD.\n',
    });

    const results = await importFromKimiCode(root, { scope: 'project' });

    const rootRule = read(root, '.agentsmesh/rules/_root.md');
    expect(rootRule).toContain('Never drop a column in the same release.');
    expect(rootRule).toContain('Use TDD.');
    expect(rootRule.indexOf('Never drop')).toBeLessThan(rootRule.indexOf('Use TDD'));
    expect(results.filter((r) => r.feature === 'rules').map((r) => r.fromPath)).toEqual([
      join(root, '.kimi-code/AGENTS.md'),
      join(root, 'AGENTS.md'),
    ]);
  });

  it('splits the embedded rules block out of every source file', async () => {
    const block = (source: string, body: string): string =>
      `<!-- agentsmesh:embedded-rules:start -->\n<!-- agentsmesh:embedded-rule:start {"source":"rules/${source}.md","description":"d","globs":[],"targets":[]} -->\n${body}\n<!-- agentsmesh:embedded-rule:end -->\n<!-- agentsmesh:embedded-rules:end -->\n`;
    const root = project({
      '.kimi-code/AGENTS.md': block('sql', 'No raw SQL.'),
      'AGENTS.md': `# Shared\n\n${block('typescript', 'No `any`.')}`,
    });

    await importFromKimiCode(root, { scope: 'project' });

    expect(read(root, '.agentsmesh/rules/sql.md')).toContain('No raw SQL.');
    expect(read(root, '.agentsmesh/rules/typescript.md')).toContain('No `any`.');
    expect(read(root, '.agentsmesh/rules/_root.md')).toContain('# Shared');
  });

  it('skips a blank source the way Kimi Code skips a whitespace-only file', async () => {
    const root = project({ '.kimi-code/AGENTS.md': '   \n', 'AGENTS.md': '# Shared\n' });
    const results = await importFromKimiCode(root, { scope: 'project' });
    expect(results.map((r) => r.fromPath)).toEqual([join(root, 'AGENTS.md')]);
  });

  it('evicts a stale .kimi-code/AGENTS.md so the rules cannot land in context twice', async () => {
    const root = project({
      '.kimi-code/AGENTS.md': '# Nested\n\nNever drop a column in the same release.\n',
      'agentsmesh.yaml': CONFIG,
    });

    await importFromKimiCode(root, { scope: 'project' });
    expect((await runGenerate({}, root, { printMatrix: false })).exitCode).toBe(0);

    expect(read(root, 'AGENTS.md')).toContain('Never drop a column in the same release.');
    expect(existsSync(join(root, '.kimi-code/AGENTS.md'))).toBe(false);
  });
});

describe('global instruction files', () => {
  it('imports the Kimi-specific and the cross-tool file together', async () => {
    const root = project({
      '.kimi-code/AGENTS.md': '# Kimi global\n',
      '.agents/AGENTS.md': '# Shared global\n',
    });

    await importFromKimiCode(root, { scope: 'global' });

    const rootRule = read(root, '.agentsmesh/rules/_root.md');
    expect(rootRule).toContain('# Kimi global');
    expect(rootRule).toContain('# Shared global');
  });

  it('keeps writing only ~/.kimi-code/AGENTS.md and never the Warp-owned file', async () => {
    const homeDir = project({
      '.agents/AGENTS.md': '# Warp owns this\n',
      '.agentsmesh/agentsmesh.yaml': CONFIG,
      '.agentsmesh/rules/_root.md': '---\nroot: true\n---\n\n# Machine rules\n',
    });
    const projectDir = project({});
    vi.stubEnv('HOME', homeDir);
    vi.stubEnv('USERPROFILE', homeDir);

    await runGenerate({ global: true }, projectDir, { printMatrix: false });

    expect(read(homeDir, '.agents/AGENTS.md')).toBe('# Warp owns this\n');
  });
});
