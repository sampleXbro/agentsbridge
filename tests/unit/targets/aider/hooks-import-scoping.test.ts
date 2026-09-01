/**
 * Regressions for `.aider.conf.yml` -> `.agentsmesh/hooks.yaml` import.
 *
 * The config holds at most one `test-cmd` and one `notifications-command`, so
 * generate necessarily drops canonical entries. Import must not then delete
 * them: it may only replace the entries that actually reached a key the config
 * speaks about, and it must not rewrite their matchers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { HookEntry } from '../../../../src/core/hook-types.js';
import { importAiderHooks } from '../../../../src/targets/aider/hooks-import.js';
import { AIDER_CONF_FILE } from '../../../../src/targets/aider/constants.js';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aider-hooks-import-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seed(conf: string, canonicalHooks: string): void {
  writeFileSync(join(dir, AIDER_CONF_FILE), conf);
  writeFileSync(join(dir, '.agentsmesh/hooks.yaml'), canonicalHooks);
}

function importedHooks(): Record<string, HookEntry[]> {
  return parseYaml(readFileSync(join(dir, '.agentsmesh/hooks.yaml'), 'utf-8')) as Record<
    string,
    HookEntry[]
  >;
}

describe('importAiderHooks keeps canonical entries the config never carried', () => {
  it('keeps the second Notification and the second broad PostToolUse hook', async () => {
    seed(
      'notifications-command: notify-send first\ntest-cmd: pytest\nauto-test: true\n',
      [
        'PostToolUse:',
        "  - matcher: '*'",
        '    command: pytest',
        "  - matcher: '*'",
        '    command: mypy .',
        'Notification:',
        "  - matcher: '*'",
        '    command: notify-send first',
        "  - matcher: '*'",
        '    command: slack-ping second',
        '',
      ].join('\n'),
    );

    await importAiderHooks(dir, []);

    const hooks = importedHooks();
    expect(hooks.Notification.map((e) => e.command)).toEqual([
      'notify-send first',
      'slack-ping second',
    ]);
    expect(hooks.PostToolUse.map((e) => e.command)).toEqual(['pytest', 'mypy .']);
  });

  it('leaves events untouched when the config carries no key for them', async () => {
    seed(
      'model: gpt-4o\nlint-cmd: ruff check\n',
      [
        'PostToolUse:',
        "  - matcher: '*'",
        '    command: pytest -q',
        '    timeout: 300',
        'Notification:',
        "  - matcher: '*'",
        '    command: notify-send done',
        '',
      ].join('\n'),
    );

    await importAiderHooks(dir, []);

    const hooks = importedHooks();
    expect(hooks.Notification.map((e) => e.command)).toEqual(['notify-send done']);
    expect(hooks.PostToolUse).toEqual([
      { matcher: 'Write|Edit', type: 'command', command: 'ruff check' },
      { matcher: '*', command: 'pytest -q', timeout: 300 },
    ]);
  });

  it('keeps the canonical matcher of a lint hook instead of rewriting it', async () => {
    seed(
      'lint-cmd:\n  - black .\n',
      ['PostToolUse:', '  - matcher: MultiEdit', '    command: black .', ''].join('\n'),
    );

    await importAiderHooks(dir, []);

    expect(importedHooks().PostToolUse).toEqual([{ matcher: 'MultiEdit', command: 'black .' }]);
  });
});
