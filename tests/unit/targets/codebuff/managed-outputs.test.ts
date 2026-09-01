/**
 * `cleanupStaleGeneratedOutputs` deletes every path a target declares in
 * `managedOutputs` that the run did not emit. `.agents/` holds the user's own
 * agent modules, so the layout lists `.agents/skills` and `.agents/mcp.json`
 * but never `.agents` itself.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject } from '../../../e2e/helpers/canonical.js';
import { cleanup } from '../../../e2e/helpers/setup.js';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { findStaleGeneratedOutputs } from '../../../../src/core/generate/stale-cleanup.js';

const ALL_FEATURES = `version: 1
targets: [codebuff]
features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]
`;

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

function seedUserAgentsDir(root: string): void {
  mkdirSync(join(root, '.agents/types'), { recursive: true });
  writeFileSync(join(root, '.agents/my-custom-agent.ts'), 'export default {}\n');
  writeFileSync(join(root, '.agents/types/agent-definition.ts'), 'export type A = never\n');
  writeFileSync(join(root, '.agents/package.json'), '{"name":"agents"}\n');
}

describe('codebuff managed outputs never claim the user .agents directory', () => {
  it('leaves user agent modules, types and package.json in place after generate', async () => {
    dir = createCanonicalProject(ALL_FEATURES);
    seedUserAgentsDir(dir);

    expect((await runGenerate({}, dir, { printMatrix: false })).exitCode).toBe(0);

    expect(existsSync(join(dir, '.agents/my-custom-agent.ts'))).toBe(true);
    expect(existsSync(join(dir, '.agents/types/agent-definition.ts'))).toBe(true);
    expect(existsSync(join(dir, '.agents/package.json'))).toBe(true);
    expect(readFileSync(join(dir, '.agents/mcp.json'), 'utf-8')).toContain('mcpServers');
  });

  it('never reports a user file under .agents as stale, whatever the run emitted', async () => {
    dir = createCanonicalProject(ALL_FEATURES);
    seedUserAgentsDir(dir);
    writeFileSync(join(dir, '.agents/mcp.json'), '{"mcpServers":{}}');
    writeFileSync(join(dir, '.codebuffignore'), 'dist/\n');

    const stale = await findStaleGeneratedOutputs({
      projectRoot: dir,
      targets: ['codebuff'],
      expectedPaths: ['AGENTS.md'],
      scope: 'project',
    });

    expect(stale).not.toContain('.agents/my-custom-agent.ts');
    expect(stale).not.toContain('.agents/types/agent-definition.ts');
    expect(stale).not.toContain('.agents/package.json');
    // The two single-purpose files agentsmesh owns end to end DO get revoked.
    expect(stale).toEqual(['.agents/mcp.json', '.codebuffignore']);
  });
});
