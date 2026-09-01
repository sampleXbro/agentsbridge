/**
 * Stale cleanup deletes every file inside a managed directory the run did not
 * emit, so the managed set has to stop at what openhands actually fills.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject, writeConfig } from '../../../e2e/helpers/canonical.js';
import { cleanup } from '../../../e2e/helpers/setup.js';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { importFromOpenhands } from '../../../../src/targets/openhands/importer.js';

const FEATURES = 'features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]';
const GOOSE_HOOKS = '.agents/plugins/agentsmesh/hooks/hooks.json';

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

async function generateAll(): Promise<void> {
  expect((await runGenerate({}, dir, { printMatrix: false })).exitCode).toBe(0);
}

describe('openhands stale cleanup', () => {
  it("never deletes goose's hooks file out of the shared plugin directory", async () => {
    dir = createCanonicalProject(`version: 1\ntargets: [openhands, goose]\n${FEATURES}\n`);
    await generateAll();
    expect(existsSync(join(dir, GOOSE_HOOKS))).toBe(true);

    writeConfig(dir, `version: 1\ntargets: [openhands]\n${FEATURES}\n`);
    await generateAll();
    expect(existsSync(join(dir, GOOSE_HOOKS))).toBe(true);
  });

  it('removes a command file the canonical directory no longer defines', async () => {
    dir = createCanonicalProject(`version: 1\ntargets: [openhands]\n${FEATURES}\n`);
    await generateAll();
    const command = join(dir, '.agents/plugins/agentsmesh/commands/review.md');
    expect(existsSync(command)).toBe(true);

    rmSync(join(dir, '.agentsmesh/commands/review.md'));
    await generateAll();
    expect(existsSync(command)).toBe(false);
  });

  it('removes an orphan agent left behind under the shared agents directory', async () => {
    dir = createCanonicalProject(`version: 1\ntargets: [openhands]\n${FEATURES}\n`);
    await generateAll();
    const orphan = join(dir, '.agents/agents/stale-openhands-junk.md');
    writeFileSync(orphan, '---\nname: stale\n---\n# Stale');

    await generateAll();
    expect(existsSync(orphan)).toBe(false);
  });

  /**
   * `.openhands/hooks.json` is THE user-authored OpenHands config file and it is
   * a managed output, so an import that silently dropped its contents would make
   * the next generate delete them. Every shape the docs use has to survive the
   * whole `hand-written -> import -> generate` chain.
   */
  it('keeps a hand-written docs-shaped hooks.json through import and generate', async () => {
    dir = createCanonicalProject(`version: 1\ntargets: [openhands]\n${FEATURES}\n`);
    rmSync(join(dir, '.agentsmesh/hooks.yaml'));
    const hooksFile = join(dir, '.openhands/hooks.json');
    mkdirSync(join(dir, '.openhands'), { recursive: true });
    writeFileSync(
      hooksFile,
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: 'execute_bash',
                hooks: [{ command: '.openhands/hooks/block-dangerous.sh', timeout: 10 }],
              },
            ],
            Stop: [
              { matcher: '*', hooks: [{ type: 'prompt', prompt: 'Did every test run?' }] },
              { matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Audit the diff' }] },
            ],
          },
        },
        null,
        2,
      ),
    );

    await importFromOpenhands(dir);
    await generateAll();
    const once = readFileSync(hooksFile, 'utf8');
    // The carry-over must not duplicate the agent handler on a second pass.
    await generateAll();
    expect(readFileSync(hooksFile, 'utf8')).toBe(once);

    const written = JSON.parse(once);
    expect(written).toEqual({
      pre_tool_use: [
        {
          matcher: 'execute_bash',
          hooks: [{ type: 'command', command: '.openhands/hooks/block-dangerous.sh', timeout: 10 }],
        },
      ],
      stop: [
        { matcher: '*', hooks: [{ type: 'prompt', prompt: 'Did every test run?' }] },
        { matcher: '*', hooks: [{ type: 'agent', system_prompt: 'Audit the diff' }] },
      ],
    });
  });

  it('never touches the hook scripts that live beside hooks.json', async () => {
    dir = createCanonicalProject(`version: 1\ntargets: [openhands]\n${FEATURES}\n`);
    const script = join(dir, '.openhands/hooks/block-dangerous.sh');
    mkdirSync(join(dir, '.openhands/hooks'), { recursive: true });
    writeFileSync(script, '#!/usr/bin/env bash\nexit 0\n');

    await generateAll();
    expect(existsSync(script)).toBe(true);

    rmSync(join(dir, '.agentsmesh/hooks.yaml'));
    await generateAll();
    expect(existsSync(script)).toBe(true);
  });

  it('removes the hooks file when canonical hooks are revoked', async () => {
    dir = createCanonicalProject(`version: 1\ntargets: [openhands]\n${FEATURES}\n`);
    await generateAll();
    const hooks = join(dir, '.openhands/hooks.json');
    expect(existsSync(hooks)).toBe(true);

    rmSync(join(dir, '.agentsmesh/hooks.yaml'));
    await generateAll();
    expect(existsSync(hooks)).toBe(false);
  });
});
