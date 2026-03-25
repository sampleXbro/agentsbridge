/**
 * E2E tests for collaboration strategies and lock edge cases.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from './helpers/run-cli.js';

function makeProject(prefix: string): string {
  const base = join(tmpdir(), prefix);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(join(base, '.agentsbridge', 'rules'), { recursive: true });
  writeFileSync(
    join(base, 'agentsbridge.yaml'),
    `version: 1
targets: [claude-code]
features: [rules]
`,
  );
  writeFileSync(
    join(base, '.agentsbridge', 'rules', '_root.md'),
    `---
root: true
---
# Root
`,
  );
  return base;
}

describe('collaboration e2e', () => {
  const created: string[] = [];

  afterEach(() => {
    while (created.length > 0) {
      const dir = created.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('strategy=lock blocks generate when locked feature changed unless --force', async () => {
    const dir = makeProject('ab-e2e-collab-lock');
    created.push(dir);
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );

    const first = await runCli('generate', dir);
    expect(first.exitCode, first.stderr).toBe(0);

    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
---
# Root changed
`,
    );

    const blocked = await runCli('generate', dir);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toContain('Locked feature violation');
    expect(blocked.stderr).toContain('generate --force');

    const forced = await runCli('generate --force', dir);
    expect(forced.exitCode, forced.stderr).toBe(0);
    expect(readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf8')).toContain('Root changed');
  });

  it('strategy=lock with empty lock_features does not block generate', async () => {
    const dir = makeProject('ab-e2e-collab-lock-empty');
    created.push(dir);
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: []
`,
    );

    expect((await runCli('generate', dir)).exitCode).toBe(0);
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Changed\n',
    );
    const second = await runCli('generate', dir);
    expect(second.exitCode, second.stderr).toBe(0);
  });

  it.each(['merge', 'last-wins'] as const)(
    'strategy=%s does not enforce lock-feature blocking on generate',
    async (strategy) => {
      const dir = makeProject(`ab-e2e-collab-${strategy}`);
      created.push(dir);
      writeFileSync(
        join(dir, 'agentsbridge.yaml'),
        `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: ${strategy}
  lock_features: [rules]
`,
      );

      expect((await runCli('generate', dir)).exitCode).toBe(0);
      writeFileSync(
        join(dir, '.agentsbridge', 'rules', '_root.md'),
        '---\nroot: true\n---\n# Changed\n',
      );
      const second = await runCli('generate', dir);
      expect(second.exitCode, second.stderr).toBe(0);
      expect(second.stderr).not.toContain('Locked feature violation');
    },
  );

  it('check marks modified, added, and removed locked files with [LOCKED]', async () => {
    const dir = makeProject('ab-e2e-collab-locked-check');
    created.push(dir);
    writeFileSync(
      join(dir, 'agentsbridge.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'extra.md'),
      '---\ndescription: Extra\n---\n# Extra\n',
    );

    const generated = await runCli('generate', dir);
    expect(generated.exitCode, generated.stderr).toBe(0);

    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      `---
root: true
---
# Modified
`,
    );
    rmSync(join(dir, '.agentsbridge', 'rules', 'extra.md'));
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', 'added.md'),
      '---\ndescription: Added\n---\n# Added\n',
    );

    const checked = await runCli('check', dir);
    expect(checked.exitCode).toBe(1);
    expect(checked.stderr).toContain('rules/_root.md was modified [LOCKED]');
    expect(checked.stderr).toContain('rules/extra.md was removed [LOCKED]');
    expect(checked.stderr).toContain('rules/added.md was added [LOCKED]');
  });
});
