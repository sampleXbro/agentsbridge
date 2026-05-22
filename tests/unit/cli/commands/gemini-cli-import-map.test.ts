/**
 * Branch-coverage tests for src/core/reference/import-maps/gemini-cli.ts.
 *
 * Targets:
 *   - extension filter (.toml / .md / other)
 *   - commandsPrefix.startsWith fallback
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildGeminiCliImportPaths } from '../../../../src/core/reference/import-maps/gemini-cli.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-gemini-import-map-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('buildGeminiCliImportPaths', () => {
  it('skips files whose extension is neither .toml nor .md', async () => {
    mkdirSync(join(projectRoot, '.gemini', 'commands'), { recursive: true });
    writeFileSync(join(projectRoot, '.gemini', 'commands', 'ignore.txt'), 'noop');
    writeFileSync(join(projectRoot, '.gemini', 'commands', 'keep.toml'), 'name = "keep"');
    writeFileSync(join(projectRoot, '.gemini', 'commands', 'docs.md'), '# docs');

    const refs = new Map<string, string>();
    await buildGeminiCliImportPaths(refs, projectRoot);

    expect(refs.has('.gemini/commands/ignore.txt')).toBe(false);
    expect(refs.get('.gemini/commands/keep.toml')).toBe('.agentsmesh/commands/keep.md');
    expect(refs.get('.gemini/commands/docs.md')).toBe('.agentsmesh/commands/docs.md');
  });

  it('maps nested command paths into colon-namespaced canonical names', async () => {
    mkdirSync(join(projectRoot, '.gemini', 'commands', 'sub', 'deep'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.gemini', 'commands', 'sub', 'deep', 'cmd.toml'),
      'name = "deep"',
    );

    const refs = new Map<string, string>();
    await buildGeminiCliImportPaths(refs, projectRoot);

    expect(refs.get('.gemini/commands/sub/deep/cmd.toml')).toBe(
      '.agentsmesh/commands/sub:deep:cmd.md',
    );
  });

  it('maps rules, agents, and skills directories', async () => {
    mkdirSync(join(projectRoot, '.gemini', 'rules'), { recursive: true });
    mkdirSync(join(projectRoot, '.gemini', 'agents'), { recursive: true });
    mkdirSync(join(projectRoot, '.gemini', 'skills', 'demo'), { recursive: true });
    writeFileSync(join(projectRoot, '.gemini', 'rules', 'r.md'), 'rule');
    writeFileSync(join(projectRoot, '.gemini', 'agents', 'a.md'), 'agent');
    writeFileSync(join(projectRoot, '.gemini', 'skills', 'demo', 'SKILL.md'), '# skill');

    const refs = new Map<string, string>();
    await buildGeminiCliImportPaths(refs, projectRoot);

    expect(refs.get('.gemini/rules/r.md')).toBe('.agentsmesh/rules/r.md');
    expect(refs.get('.gemini/agents/a.md')).toBe('.agentsmesh/agents/a.md');
    expect(refs.has('.gemini/skills/demo/SKILL.md')).toBe(true);
  });
});
