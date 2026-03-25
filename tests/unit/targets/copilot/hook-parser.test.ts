import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  extractMatcher,
  extractWrapperCommand,
  importHooks,
  mapCopilotHookEvent,
} from '../../../../src/targets/copilot/hook-parser.js';

describe('copilot hook parser helpers', () => {
  it('maps known hook events and rejects unknown ones', () => {
    expect(mapCopilotHookEvent('preToolUse')).toBe('PreToolUse');
    expect(mapCopilotHookEvent('postToolUse')).toBe('PostToolUse');
    expect(mapCopilotHookEvent('notification')).toBe('Notification');
    expect(mapCopilotHookEvent('userPromptSubmitted')).toBe('UserPromptSubmit');
    expect(mapCopilotHookEvent('other')).toBeNull();
  });

  it('extracts matchers from comment metadata', () => {
    expect(extractMatcher('Matcher: src/**/*.ts')).toBe('src/**/*.ts');
    expect(extractMatcher('plain comment')).toBe('*');
    expect(extractMatcher(42)).toBe('*');
  });

  it('prefers explicit command metadata over shell body parsing', () => {
    expect(extractWrapperCommand('#!/bin/sh\n# agentsbridge-command: pnpm lint\npnpm test\n')).toBe(
      'pnpm lint',
    );
  });

  it('strips shell boilerplate when no explicit metadata is present', () => {
    expect(
      extractWrapperCommand(
        '#!/bin/sh\n# comment\nHOOK_DIR=/tmp/hooks\nset -e\npnpm test --runInBand\n',
      ),
    ).toBe('pnpm test --runInBand');
  });
});

describe('importHooks', () => {
  let projectRoot = '';

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('imports JSON copilot hooks and normalizes wrapper scripts into hooks.yaml', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ab-copilot-hooks-'));
    const hooksDir = join(projectRoot, '.github', 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    writeFileSync(
      join(hooksDir, 'agentsbridge.json'),
      JSON.stringify({
        hooks: {
          preToolUse: [{ bash: './pre.sh', comment: 'Matcher: src/**/*.ts' }],
          userPromptSubmitted: [{ bash: './prompt.sh' }],
        },
      }),
    );
    writeFileSync(join(hooksDir, 'pre.sh'), '#!/bin/sh\n# agentsbridge-command: pnpm lint\n');
    writeFileSync(
      join(hooksDir, 'prompt.sh'),
      '#!/bin/sh\n# comment\nHOOK_DIR=/tmp/hooks\nset -e\npnpm test --runInBand\n',
    );

    const results = await runImport();
    const hooks = readHooksYaml(projectRoot);

    expect(results).toEqual([
      {
        fromTool: 'copilot',
        fromPath: join(projectRoot, '.github', 'hooks'),
        toPath: '.agentsbridge/hooks.yaml',
        feature: 'hooks',
      },
    ]);
    expect(hooks).toEqual({
      PreToolUse: [{ matcher: 'src/**/*.ts', command: 'pnpm lint', type: 'command' }],
      UserPromptSubmit: [{ matcher: '*', command: 'pnpm test --runInBand', type: 'command' }],
    });
  });

  it('imports legacy shell wrappers when JSON hooks are absent or invalid', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ab-copilot-hooks-'));
    const hooksDir = join(projectRoot, '.github', 'hooks');
    const legacyDir = join(projectRoot, '.github', 'copilot-hooks');
    mkdirSync(hooksDir, { recursive: true });
    mkdirSync(legacyDir, { recursive: true });

    writeFileSync(join(hooksDir, 'invalid.json'), '{not valid json');
    writeFileSync(join(legacyDir, 'PostToolUse-1.sh'), '#!/bin/sh\npnpm test\n');

    const results = await runImport();
    const hooks = readHooksYaml(projectRoot);

    expect(results).toHaveLength(1);
    expect(hooks).toEqual({
      PostToolUse: [{ matcher: '*', command: 'pnpm test', type: 'command' }],
    });
  });

  it('does not write hooks.yaml when no valid hook commands are found', async () => {
    projectRoot = mkdtempSync(join(tmpdir(), 'ab-copilot-hooks-'));
    const hooksDir = join(projectRoot, '.github', 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    writeFileSync(
      join(hooksDir, 'agentsbridge.json'),
      JSON.stringify({
        hooks: {
          unsupported: [{ bash: './missing.sh' }],
          preToolUse: [{ comment: 'Matcher: src/**/*.ts' }],
        },
      }),
    );

    const results = await runImport();

    expect(results).toEqual([]);
    expect(() => readFileSync(join(projectRoot, '.agentsbridge', 'hooks.yaml'), 'utf-8')).toThrow();
  });

  async function runImport() {
    const results: Array<{
      fromTool: string;
      fromPath: string;
      toPath: string;
      feature: string;
    }> = [];
    await importHooks(projectRoot, results);
    return results;
  }
});

function readHooksYaml(projectRoot: string): Record<string, unknown> {
  return parseYaml(
    readFileSync(join(projectRoot, '.agentsbridge', 'hooks.yaml'), 'utf-8'),
  ) as Record<string, unknown>;
}
