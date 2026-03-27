import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { readJson, readYaml, readText } from './helpers/assertions.js';

function writeProject(dir: string, target: string): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    `version: 1\ntargets: [${target}]\nfeatures: [rules, hooks]\n`,
  );
  writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

describe('hooks round-trip e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('round-trips Cursor hooks with env vars and quoting preserved', async () => {
    dir = createTestProject();
    writeProject(dir, 'cursor');
    writeFileSync(
      join(dir, '.agentsmesh', 'hooks.yaml'),
      [
        'PreToolUse:',
        '  - matcher: Bash',
        '    command: env FOO="$BAR" sh -lc \'printf "%s" "$FOO"\'',
        '    timeout: 1500',
        'Notification:',
        '  - matcher: ".*"',
        '    type: prompt',
        '    command: \'echo "notify:$MESSAGE"\'',
        '',
      ].join('\n'),
    );

    expect((await runCli('generate --targets cursor', dir)).exitCode).toBe(0);
    expect(readJson(join(dir, '.cursor', 'hooks.json'))).toEqual({
      version: 1,
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: 'env FOO="$BAR" sh -lc \'printf "%s" "$FOO"\'',
                timeout: 1500,
              },
            ],
          },
        ],
        Notification: [
          {
            matcher: '.*',
            hooks: [{ type: 'prompt', prompt: 'echo "notify:$MESSAGE"' }],
          },
        ],
      },
    });

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    expect((await runCli('import --from cursor', dir)).exitCode).toBe(0);
    expect(readYaml(join(dir, '.agentsmesh', 'hooks.yaml'))).toEqual({
      PreToolUse: [
        {
          matcher: 'Bash',
          type: 'command',
          command: 'env FOO="$BAR" sh -lc \'printf "%s" "$FOO"\'',
          timeout: 1500,
        },
      ],
      Notification: [{ matcher: '.*', type: 'prompt', command: 'echo "notify:$MESSAGE"' }],
    });
  });

  it('round-trips Copilot hooks with stable wrapper naming and rounded timeouts', async () => {
    dir = createTestProject();
    writeProject(dir, 'copilot');
    writeFileSync(
      join(dir, '.agentsmesh', 'hooks.yaml'),
      [
        'PostToolUse:',
        '  - matcher: Write|Edit',
        '    command: env FOO="$BAR" prettier --write "$FILE_PATH"',
        '    timeout: 1500',
        '  - matcher: Bash',
        '    command: \'echo "done:$TOOL"\'',
        '    timeout: 3001',
        'Notification:',
        '  - matcher: ".*"',
        '    command: \'echo "note:$MESSAGE"\'',
        '',
      ].join('\n'),
    );

    expect((await runCli('generate --targets copilot', dir)).exitCode).toBe(0);
    expect(readJson(join(dir, '.github', 'hooks', 'agentsmesh.json'))).toEqual({
      version: 1,
      hooks: {
        postToolUse: [
          {
            type: 'command',
            bash: './scripts/posttooluse-0.sh',
            comment: 'Matcher: Write|Edit',
            timeoutSec: 2,
          },
          {
            type: 'command',
            bash: './scripts/posttooluse-1.sh',
            comment: 'Matcher: Bash',
            timeoutSec: 4,
          },
        ],
        notification: [
          { type: 'command', bash: './scripts/notification-0.sh', comment: 'Matcher: .*' },
        ],
      },
    });
    expect(readText(join(dir, '.github', 'hooks', 'scripts', 'posttooluse-0.sh'))).toContain(
      '# agentsmesh-command: env FOO="$BAR" prettier --write "$FILE_PATH"',
    );
    expect(readText(join(dir, '.github', 'hooks', 'scripts', 'posttooluse-1.sh'))).toContain(
      '# agentsmesh-command: echo "done:$TOOL"',
    );

    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    expect((await runCli('import --from copilot', dir)).exitCode).toBe(0);
    expect(readYaml(join(dir, '.agentsmesh', 'hooks.yaml'))).toEqual({
      Notification: [{ matcher: '.*', command: 'echo "note:$MESSAGE"', type: 'command' }],
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          command: 'env FOO="$BAR" prettier --write "$FILE_PATH"',
          type: 'command',
        },
        { matcher: 'Bash', command: 'echo "done:$TOOL"', type: 'command' },
      ],
    });
  });
});
