import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import type { CanonicalFiles, ImportResult } from '../../../../src/core/types.js';
import { importAiderHooks } from '../../../../src/targets/aider/hooks-import.js';
import { emitAiderConf } from '../../../../src/targets/aider/conf-file.js';

const CANONICAL = '.agentsmesh/hooks.yaml';
let root = '';

function setup(files: Record<string, string>): string {
  root = join(tmpdir(), `aider-hooks-import-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
  }
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  return root;
}

function canonicalHooks(): Record<string, unknown[]> {
  return parseYaml(readFileSync(join(root, CANONICAL), 'utf-8')) as Record<string, unknown[]>;
}

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = '';
});

describe('importAiderHooks', () => {
  it('imports lint-cmd, test-cmd and notifications-command into canonical hooks', async () => {
    const projectRoot = setup({
      '.aider.conf.yml':
        'lint-cmd:\n  - ruff check\ntest-cmd: pytest\nauto-test: true\nnotifications-command: notify\n',
    });
    const results: ImportResult[] = [];

    await importAiderHooks(projectRoot, results);

    expect(results).toEqual([
      {
        fromTool: 'aider',
        fromPath: join(projectRoot, '.aider.conf.yml'),
        toPath: CANONICAL,
        feature: 'hooks',
      },
    ]);
    expect(canonicalHooks()).toEqual({
      PostToolUse: [
        { matcher: 'Write|Edit', type: 'command', command: 'ruff check' },
        { matcher: '*', type: 'command', command: 'pytest' },
      ],
      Notification: [{ matcher: '*', type: 'command', command: 'notify' }],
    });
  });

  it('keeps canonical entries aider cannot express and every other event', async () => {
    const projectRoot = setup({
      '.aider.conf.yml': 'lint-cmd: ruff\n',
      [CANONICAL]:
        '# hand written\nPreToolUse:\n  - matcher: Bash\n    command: guard\nPostToolUse:\n' +
        '  - matcher: Bash\n    command: audit\n  - matcher: Edit\n    command: stale\n',
    });

    await importAiderHooks(projectRoot, []);

    const hooks = canonicalHooks();
    expect(hooks.PreToolUse).toEqual([{ matcher: 'Bash', command: 'guard' }]);
    expect(hooks.PostToolUse).toEqual([
      { matcher: 'Write|Edit', type: 'command', command: 'ruff' },
      { matcher: 'Bash', command: 'audit' },
    ]);
    expect(readFileSync(join(projectRoot, CANONICAL), 'utf-8')).toContain('# hand written');
  });

  it('keeps the matcher and the fields aider cannot carry on a reused entry', async () => {
    const projectRoot = setup({
      '.aider.conf.yml': 'lint-cmd: ruff\n',
      [CANONICAL]: 'PostToolUse:\n  - matcher: Edit\n    command: ruff\n    timeout: 30\n',
    });

    await importAiderHooks(projectRoot, []);

    expect(canonicalHooks().PostToolUse).toEqual([
      { matcher: 'Edit', command: 'ruff', timeout: 30 },
    ]);
  });

  it('keeps a canonical event the config carries no key for', async () => {
    const projectRoot = setup({
      '.aider.conf.yml': 'lint-cmd: ruff\n',
      [CANONICAL]: 'Notification:\n  - matcher: "*"\n    command: old-notify\n',
    });

    await importAiderHooks(projectRoot, []);

    expect(canonicalHooks().Notification).toEqual([{ matcher: '*', command: 'old-notify' }]);
  });

  it('replaces the entry behind a key the config does carry', async () => {
    const projectRoot = setup({
      '.aider.conf.yml': 'notifications-command: new-notify\n',
      [CANONICAL]: 'Notification:\n  - matcher: "*"\n    command: old-notify\n',
    });

    await importAiderHooks(projectRoot, []);

    expect(canonicalHooks().Notification).toEqual([
      { matcher: '*', type: 'command', command: 'new-notify' },
    ]);
  });

  it('does nothing when the config carries no aider hook key', async () => {
    const projectRoot = setup({ '.aider.conf.yml': 'model: gpt-4o\nread:\n  - CONVENTIONS.md\n' });
    const results: ImportResult[] = [];

    await importAiderHooks(projectRoot, results);

    expect(results).toHaveLength(0);
    expect(() => readFileSync(join(projectRoot, CANONICAL), 'utf-8')).toThrow();
  });

  it('does nothing when there is no aider config file', async () => {
    const projectRoot = setup({ 'CONVENTIONS.md': '# Root' });
    const results: ImportResult[] = [];

    await importAiderHooks(projectRoot, results);

    expect(results).toHaveLength(0);
  });

  it('does nothing when the aider config is unparseable', async () => {
    const projectRoot = setup({ '.aider.conf.yml': 'lint-cmd: [broken\n' });
    const results: ImportResult[] = [];

    await importAiderHooks(projectRoot, results);

    expect(results).toHaveLength(0);
  });

  it('starts from a fresh canonical file when the existing one is not a map', async () => {
    const projectRoot = setup({
      '.aider.conf.yml': 'lint-cmd: ruff\n',
      [CANONICAL]: 'just a scalar\n',
    });

    await importAiderHooks(projectRoot, []);

    expect(canonicalHooks()).toEqual({
      PostToolUse: [{ matcher: 'Write|Edit', type: 'command', command: 'ruff' }],
    });
  });

  it('round-trips generate -> write -> import -> generate byte for byte', async () => {
    const canonical = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: {
        PostToolUse: [
          { matcher: 'Write|Edit', command: 'ruff check' },
          { matcher: '*', command: 'pytest' },
        ],
        Notification: [{ matcher: '*', command: 'notify' }],
      },
      ignore: [],
    } satisfies CanonicalFiles;

    const features = new Set(['hooks']);
    const first = emitAiderConf(canonical, 'project', features);
    const projectRoot = setup({ '.aider.conf.yml': first[0].content });
    await importAiderHooks(projectRoot, []);

    const reimported = { ...canonical, hooks: canonicalHooks() } as unknown as CanonicalFiles;
    expect(emitAiderConf(reimported, 'project', features)[0].content).toBe(first[0].content);
  });

  it('ignores malformed canonical entries when preserving unmappable ones', async () => {
    const projectRoot = setup({
      '.aider.conf.yml': 'lint-cmd: ruff\n',
      [CANONICAL]: 'PostToolUse: notalist\nNotification:\n  - "scalar entry"\n',
    });

    await importAiderHooks(projectRoot, []);

    const hooks = canonicalHooks();
    expect(hooks.PostToolUse).toEqual([
      { matcher: 'Write|Edit', type: 'command', command: 'ruff' },
    ]);
    expect(hooks.Notification).toBeUndefined();
  });
});
