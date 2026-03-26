import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { addHookScriptAssets } from '../../../../src/targets/copilot/hook-assets.js';

function makeCanonical(hooks: CanonicalFiles['hooks']): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks,
    ignore: [],
  };
}

describe('addHookScriptAssets', () => {
  let projectRoot = '';

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('returns existing outputs when no hooks are configured', async () => {
    const outputs = [{ path: '.github/hooks/agentsmesh.json', content: '{}' }];

    await expect(addHookScriptAssets('/repo', makeCanonical(null), outputs)).resolves.toEqual(
      outputs,
    );
  });

  it('adds wrapper scripts for command hooks', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'am-copilot-assets-'));

    const outputs = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        PreToolUse: [{ matcher: 'src/**/*.ts', command: 'pnpm lint', type: 'command' }],
      }),
      [],
    );

    expect(outputs).toEqual([
      {
        path: '.github/hooks/scripts/pretooluse-0.sh',
        content: [
          '#!/usr/bin/env bash',
          '# agentsmesh-matcher: src/**/*.ts',
          '# agentsmesh-command: pnpm lint',
          'set -e',
          'HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
          'pnpm lint',
          '',
        ].join('\n'),
      },
    ]);
  });

  it('copies referenced script assets and rewrites wrapper commands to use HOOK_DIR', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'am-copilot-assets-'));
    mkdirSync(join(projectRoot, 'scripts'), { recursive: true });
    writeFileSync(join(projectRoot, 'scripts', 'notify.sh'), '#!/bin/sh\necho notified\n');

    const outputs = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        Notification: [{ matcher: '*', command: 'bash scripts/notify.sh --flag', type: 'command' }],
      }),
      [],
    );

    expect(outputs).toEqual([
      {
        path: '.github/hooks/scripts/notification-0.sh',
        content: [
          '#!/usr/bin/env bash',
          '# agentsmesh-matcher: *',
          '# agentsmesh-command: bash "$HOOK_DIR/scripts/notify.sh" --flag',
          'set -e',
          'HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
          'bash "$HOOK_DIR/scripts/notify.sh" --flag',
          '',
        ].join('\n'),
      },
      {
        path: '.github/hooks/scripts/scripts/notify.sh',
        content: '#!/bin/sh\necho notified\n',
      },
    ]);
  });

  it('skips prompt hooks and missing asset files', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'am-copilot-assets-'));

    const outputs = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        PostToolUse: [
          { matcher: '*', command: 'scripts/missing.sh', type: 'command' },
          { matcher: '*', prompt: 'Explain the tool result', type: 'prompt' },
        ],
      }),
      [],
    );

    expect(outputs).toEqual([
      {
        path: '.github/hooks/scripts/posttooluse-0.sh',
        content: [
          '#!/usr/bin/env bash',
          '# agentsmesh-matcher: *',
          '# agentsmesh-command: scripts/missing.sh',
          'set -e',
          'HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
          'scripts/missing.sh',
          '',
        ].join('\n'),
      },
    ]);
  });

  it('leaves non-script commands untouched when they do not match the asset pattern', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'am-copilot-assets-'));

    const outputs = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        Notification: [{ matcher: '*', command: 'pnpm lint', type: 'command' }],
      }),
      [],
    );

    expect(outputs).toEqual([
      {
        path: '.github/hooks/scripts/notification-0.sh',
        content: [
          '#!/usr/bin/env bash',
          '# agentsmesh-matcher: *',
          '# agentsmesh-command: pnpm lint',
          'set -e',
          'HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
          'pnpm lint',
          '',
        ].join('\n'),
      },
    ]);
  });

  it('deduplicates copied assets when multiple hooks reference the same script', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'am-copilot-assets-'));
    mkdirSync(join(projectRoot, 'scripts'), { recursive: true });
    writeFileSync(join(projectRoot, 'scripts', 'notify.sh'), '#!/bin/sh\necho notified\n');

    const outputs = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        PreToolUse: [{ matcher: '*', command: 'bash scripts/notify.sh', type: 'command' }],
        PostToolUse: [{ matcher: '*', command: 'bash scripts/notify.sh --flag', type: 'command' }],
      }),
      [],
    );

    expect(
      outputs.filter((output) => output.path === '.github/hooks/scripts/scripts/notify.sh'),
    ).toHaveLength(1);
  });

  it('does not copy assets that point outside the repo root', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'am-copilot-assets-'));

    const outputs = await addHookScriptAssets(
      projectRoot,
      makeCanonical({
        Notification: [{ matcher: '*', command: 'bash ../outside.sh', type: 'command' }],
      }),
      [],
    );

    expect(outputs).toEqual([
      {
        path: '.github/hooks/scripts/notification-0.sh',
        content: [
          '#!/usr/bin/env bash',
          '# agentsmesh-matcher: *',
          '# agentsmesh-command: bash ../outside.sh',
          'set -e',
          'HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
          'bash ../outside.sh',
          '',
        ].join('\n'),
      },
    ]);
  });
});
