/**
 * Global-scope hooks support for Copilot CLI: ~/.copilot/hooks/agentsmesh.json
 * (+ wrapper scripts), same {version, hooks} schema as project scope
 * (docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCopilotGlobalHooks } from '../../../../src/targets/copilot/global-hooks.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('generateCopilotGlobalHooks', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cop-global-hooks-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns [] when there are no canonical hooks', async () => {
    expect(await generateCopilotGlobalHooks(emptyCanonical(), root)).toEqual([]);
  });

  it('emits .copilot/hooks/agentsmesh.json with a real matcher field', async () => {
    const results = await generateCopilotGlobalHooks(
      {
        ...emptyCanonical(),
        hooks: {
          PostToolUse: [{ matcher: 'Write|Edit', command: 'prettier --write', type: 'command' }],
        },
      },
      root,
    );
    const main = results.find((r) => r.path === '.copilot/hooks/agentsmesh.json');
    expect(main).toBeDefined();
    expect(main!.status).toBe('created');
    const parsed = JSON.parse(main!.content) as { version: number; hooks: Record<string, unknown> };
    expect(parsed.version).toBe(1);
    expect(parsed.hooks.postToolUse).toEqual([
      { type: 'command', bash: './scripts/posttooluse-0.sh', matcher: 'Write|Edit' },
    ]);
  });

  it('emits wrapper scripts alongside the main JSON', async () => {
    const results = await generateCopilotGlobalHooks(
      {
        ...emptyCanonical(),
        hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi', type: 'command' }] },
      },
      root,
    );
    const wrapper = results.find((r) => r.path === '.copilot/hooks/scripts/pretooluse-0.sh');
    expect(wrapper).toBeDefined();
    expect(wrapper!.content).toContain('echo hi');
    expect(wrapper!.content).toContain('#!/usr/bin/env bash');
  });

  it('reports status="unchanged" when existing content matches', async () => {
    const canonical: CanonicalFiles = {
      ...emptyCanonical(),
      hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi', type: 'command' }] },
    };
    const first = await generateCopilotGlobalHooks(canonical, root);
    const main = first.find((r) => r.path === '.copilot/hooks/agentsmesh.json')!;
    mkdirSync(join(root, '.copilot', 'hooks'), { recursive: true });
    writeFileSync(join(root, '.copilot', 'hooks', 'agentsmesh.json'), main.content);
    const second = await generateCopilotGlobalHooks(canonical, root);
    expect(second.find((r) => r.path === '.copilot/hooks/agentsmesh.json')!.status).toBe(
      'unchanged',
    );
  });

  it('reports status="updated" when existing content differs', async () => {
    mkdirSync(join(root, '.copilot', 'hooks'), { recursive: true });
    writeFileSync(join(root, '.copilot', 'hooks', 'agentsmesh.json'), '{"version":1,"hooks":{}}');
    const results = await generateCopilotGlobalHooks(
      {
        ...emptyCanonical(),
        hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi', type: 'command' }] },
      },
      root,
    );
    expect(results.find((r) => r.path === '.copilot/hooks/agentsmesh.json')!.status).toBe(
      'updated',
    );
  });
});
