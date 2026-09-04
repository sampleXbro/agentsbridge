/** The e2e fixture must import cleanly on its own, not just synthetic content. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { importFromOpenhands } from '../../../../src/targets/openhands/importer.js';

const FIXTURE = join(process.cwd(), 'tests', 'e2e', 'fixtures', 'openhands-project');
const COMMAND = '.agents/plugins/agentsmesh/commands/review.md';

let dir = '';

function read(relPath: string): string {
  return readFileSync(join(dir, relPath), 'utf-8');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'am-openhands-fixture-'));
  cpSync(FIXTURE, dir, { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('openhands e2e fixture import', () => {
  it('maps every fixture surface to its canonical destination', async () => {
    const results = await importFromOpenhands(dir, { scope: 'project' });
    expect([...new Set(results.map((r) => r.toPath))].sort()).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/agents/researcher.md',
      '.agentsmesh/commands/review.md',
      '.agentsmesh/hooks.yaml',
      '.agentsmesh/mcp.json',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/typescript.md',
      '.agentsmesh/skills/debugging/SKILL.md',
      '.agentsmesh/skills/debugging/references/checklist.md',
    ]);
  });

  it('carries the fixture content across', async () => {
    await importFromOpenhands(dir, { scope: 'project' });
    expect(read('.agentsmesh/rules/_root.md')).toContain('Project Instructions');
    expect(read('.agentsmesh/rules/_root.md')).toContain('root: true');
    expect(read('.agentsmesh/rules/typescript.md')).toContain('src/**/*.ts');
    expect(read('.agentsmesh/commands/review.md')).toContain('Bash(git diff)');
    expect(read('.agentsmesh/agents/code-reviewer.md')).toContain('model: sonnet');
    expect(read('.agentsmesh/skills/debugging/SKILL.md')).toContain('name: debugging');
    expect(read('.agentsmesh/mcp.json')).toContain('context7');
    expect(read('.agentsmesh/hooks.yaml')).toContain('PostToolUse');
    expect(read('.agentsmesh/hooks.yaml')).toContain('SessionStart');
    expect(read('.agentsmesh/hooks.yaml')).toContain('timeout: 120');
  });

  /**
   * The fixture hooks file is written the way OpenHands' own docs write one:
   * command handlers with no `type` (HookDefinition defaults to COMMAND) and a
   * prompt handler. Hand-writing `"type": "command"` everywhere would hide an
   * importer that only accepts explicit types.
   */
  it('imports the docs-shaped handlers, including the prompt hook', async () => {
    await importFromOpenhands(dir, { scope: 'project' });
    const hooks = parse(read('.agentsmesh/hooks.yaml')) as Record<string, unknown[]>;
    expect(hooks.PreToolUse).toEqual([
      {
        matcher: 'terminal',
        command: 'bash .openhands/hooks/block-dangerous.sh',
        type: 'command',
        timeout: 10,
      },
    ]);
    expect(hooks.Stop).toEqual([
      {
        matcher: '*',
        command: '',
        type: 'prompt',
        prompt: 'Confirm every changed behaviour has a test before finishing.',
      },
    ]);
  });

  /**
   * KNOWN LOSS, repo-wide and not openhands-specific: OpenHands reads
   * `argument-hint` from command frontmatter (plugin/types.py), canonical has no
   * field for it, and claude-code loses it the same way. Nothing is dropped FROM
   * canonical, so there is no lint warning to emit; this test pins the loss so a
   * future canonical `argumentHint` field has a failing assertion to flip.
   */
  it('drops the command argument-hint, which canonical cannot hold', async () => {
    expect(readFileSync(join(FIXTURE, COMMAND), 'utf-8')).toContain('argument-hint');
    await importFromOpenhands(dir, { scope: 'project' });
    expect(read('.agentsmesh/commands/review.md')).not.toContain('argument-hint');
  });
});
