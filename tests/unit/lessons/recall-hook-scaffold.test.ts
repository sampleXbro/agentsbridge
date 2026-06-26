import { existsSync, mkdirSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { injectRecallHook, RECALL_HOOK_COMMAND } from '../../../src/lessons/recall-hook-scaffold.js';

let root: string;
const hooksPath = (): string => join(root, '.agentsmesh', 'hooks.yaml');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-recallhook-'));
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function eventCommands(event: 'PreToolUse' | 'PostToolUse'): string[] {
  const parsed = parseYaml(readFileSync(hooksPath(), 'utf8')) as Record<
    string,
    Array<{ command?: string }> | undefined
  >;
  return (parsed[event] ?? []).map((h) => h.command ?? '');
}

describe('injectRecallHook', () => {
  it('adds a PreToolUse (first-touch) + PostToolUse recall hook, preserving directive + comments', () => {
    writeFileSync(
      hooksPath(),
      '# yaml-language-server: $schema=./schema.json\n# Lifecycle hooks — example\n',
      'utf8',
    );
    expect(injectRecallHook(root)).toBe(true);
    const text = readFileSync(hooksPath(), 'utf8');
    expect(text).toContain('# yaml-language-server: $schema=./schema.json');
    expect(text).toContain('# Lifecycle hooks — example');
    expect(eventCommands('PreToolUse')).toContain(RECALL_HOOK_COMMAND);
    expect(eventCommands('PostToolUse')).toContain(RECALL_HOOK_COMMAND);
  });

  it('is idempotent by command — a second run adds nothing and changes nothing', () => {
    writeFileSync(hooksPath(), '# yaml-language-server: $schema=./schema.json\n', 'utf8');
    expect(injectRecallHook(root)).toBe(true);
    const after1 = readFileSync(hooksPath(), 'utf8');
    expect(injectRecallHook(root)).toBe(false);
    expect(readFileSync(hooksPath(), 'utf8')).toBe(after1);
    expect(eventCommands('PreToolUse').filter((c) => c === RECALL_HOOK_COMMAND)).toHaveLength(1);
    expect(eventCommands('PostToolUse').filter((c) => c === RECALL_HOOK_COMMAND)).toHaveLength(1);
  });

  it('preserves an existing user PostToolUse hook and appends the recall one to each event', () => {
    writeFileSync(
      hooksPath(),
      'PostToolUse:\n  - matcher: Edit\n    type: command\n    command: npm run lint\n',
      'utf8',
    );
    expect(injectRecallHook(root)).toBe(true);
    expect(eventCommands('PostToolUse')).toEqual(['npm run lint', RECALL_HOOK_COMMAND]);
    expect(eventCommands('PreToolUse')).toEqual([RECALL_HOOK_COMMAND]);
  });

  it('does not create hooks.yaml when absent — only injects into an existing file', () => {
    rmSync(hooksPath(), { force: true });
    expect(existsSync(hooksPath())).toBe(false);
    expect(injectRecallHook(root)).toBe(false);
    expect(existsSync(hooksPath())).toBe(false);
  });
});
