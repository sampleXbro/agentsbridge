/** A zero-byte canonical file is skipped with a warning naming it, never silently. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseRules } from '../../../src/canonical/features/rules.js';
import { parseCommands } from '../../../src/canonical/features/commands.js';
import { parseAgents } from '../../../src/canonical/features/agents.js';
import { logger } from '../../../src/utils/output/logger.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'am-'));
  for (const sub of ['rules', 'commands', 'agents'])
    await mkdir(join(dir, sub), { recursive: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe('empty canonical files', () => {
  it('rules: warns with the path and skips the file', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await writeFile(join(dir, 'rules', '_root.md'), '', 'utf-8');
    await writeFile(join(dir, 'rules', 'ok.md'), '# ok\n', 'utf-8');
    const rules = await parseRules(join(dir, 'rules'));
    expect(rules.map((r) => r.source.endsWith('ok.md'))).toEqual([true]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('_root.md'));
    expect(warn.mock.calls[0]![0]).toMatch(/empty/i);
  });

  it('commands and agents: warn with the path', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await writeFile(join(dir, 'commands', 'build.md'), '   \n', 'utf-8');
    await writeFile(join(dir, 'agents', 'reviewer.md'), '', 'utf-8');
    expect(await parseCommands(join(dir, 'commands'))).toEqual([]);
    expect(await parseAgents(join(dir, 'agents'))).toEqual([]);
    const messages = warn.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('build.md'))).toBe(true);
    expect(messages.some((m) => m.includes('reviewer.md'))).toBe(true);
  });
});
