import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestProject, cleanup } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';
import { readJson, fileNotExists } from './helpers/assertions.js';

function writeProject(dir: string, target: string, features: string[]): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    `version: 1\ntargets: [${target}]\nfeatures: [rules, ${features.join(', ')}]\n`,
  );
  writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

describe('partial capability subset contracts', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('keeps the exact Cursor permissions subset and emits a deterministic warning', async () => {
    dir = createTestProject();
    writeProject(dir, 'cursor', ['permissions']);
    writeFileSync(
      join(dir, '.agentsmesh', 'permissions.yaml'),
      'allow:\n  - Read\n  - Bash(npm run test:*)\ndeny:\n  - Read(./.env)\n  - Bash(curl:*)\n',
    );

    expect((await runCli('generate --targets cursor', dir)).exitCode).toBe(0);
    fileNotExists(join(dir, '.cursor', 'permissions.json'));

    const lintResult = await runCli('lint --targets cursor', dir);
    expect(lintResult.stdout + lintResult.stderr).toContain(
      'Cursor permissions are partial; tool-level allow/deny may lose fidelity.',
    );
  });

  it('keeps only supported Gemini hook events and warns for unsupported ones', async () => {
    dir = createTestProject();
    writeProject(dir, 'gemini-cli', ['hooks']);
    writeFileSync(
      join(dir, '.agentsmesh', 'hooks.yaml'),
      [
        'PreToolUse:',
        '  - matcher: Bash',
        '    command: echo pre',
        'PostToolUse:',
        '  - matcher: Write',
        '    command: echo post',
        'Notification:',
        '  - matcher: ".*"',
        '    command: echo notify',
        'SubagentStart:',
        '  - matcher: ".*"',
        '    command: echo start',
        '',
      ].join('\n'),
    );

    expect((await runCli('generate --targets gemini-cli', dir)).exitCode).toBe(0);
    const settings = readJson(join(dir, '.gemini', 'settings.json'));
    expect(settings['hooks']).toEqual({
      BeforeTool: [
        {
          matcher: 'Bash',
          hooks: [{ name: 'BeforeTool-1', type: 'command', command: 'echo pre' }],
        },
      ],
      AfterTool: [
        {
          matcher: 'Write',
          hooks: [{ name: 'AfterTool-1', type: 'command', command: 'echo post' }],
        },
      ],
      Notification: [
        {
          matcher: '.*',
          hooks: [{ name: 'Notification-1', type: 'command', command: 'echo notify' }],
        },
      ],
    });

    const lintResult = await runCli('lint --targets gemini-cli', dir);
    expect(lintResult.stdout + lintResult.stderr).toContain(
      'SubagentStart is not supported by gemini-cli; only PreToolUse, PostToolUse, and Notification are projected.',
    );
  });

  it('keeps exact Windsurf and Copilot partial subsets with deterministic warnings', async () => {
    dir = createTestProject();
    writeProject(dir, 'windsurf', ['mcp']);
    writeFileSync(
      join(dir, '.agentsmesh', 'mcp.json'),
      JSON.stringify(
        { mcpServers: { context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } } },
        null,
        2,
      ),
    );

    expect((await runCli('generate --targets windsurf', dir)).exitCode).toBe(0);
    expect(readJson(join(dir, '.windsurf', 'mcp_config.example.json'))).toEqual({
      mcpServers: {
        context7: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
          env: {},
        },
      },
    });

    const windsurfLint = await runCli('lint --targets windsurf', dir);
    expect(windsurfLint.stdout + windsurfLint.stderr).toContain(
      'Windsurf MCP is partial; generated .windsurf/mcp_config.example.json is a reference artifact and may require manual setup.',
    );

    writeProject(dir, 'copilot', ['hooks']);
    writeFileSync(
      join(dir, '.agentsmesh', 'hooks.yaml'),
      [
        'PreToolUse:',
        '  - matcher: Bash',
        '    command: echo pre',
        'SubagentStop:',
        '  - matcher: ".*"',
        '    command: echo stop',
        '',
      ].join('\n'),
    );

    expect((await runCli('generate --targets copilot', dir)).exitCode).toBe(0);
    expect(readJson(join(dir, '.github', 'hooks', 'agentsmesh.json'))).toEqual({
      version: 1,
      hooks: {
        preToolUse: [
          { type: 'command', bash: './scripts/pretooluse-0.sh', comment: 'Matcher: Bash' },
        ],
      },
    });

    const copilotLint = await runCli('lint --targets copilot', dir);
    expect(copilotLint.stdout + copilotLint.stderr).toContain(
      'SubagentStop is not supported by Copilot hooks; only PreToolUse, PostToolUse, Notification, and UserPromptSubmit are projected.',
    );
  });
});
