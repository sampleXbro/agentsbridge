/**
 * Branch coverage for the `?? null` fallback paths in
 * `src/mcp/handlers/agents.ts` and `src/mcp/handlers/commands.ts`. The
 * existing handler tests always seed full frontmatter (`description`,
 * `tools`, `model`, `allowed-tools`), so the "field missing" branch is
 * never executed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveContext } from '../../../../src/mcp/context.js';
import { agentsHandlers } from '../../../../src/mcp/handlers/agents.js';
import { commandsHandlers } from '../../../../src/mcp/handlers/commands.js';

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'am-summary-fallbacks-'));
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [agents, commands]\nextends: []\n',
  );
  await mkdir(join(projectRoot, '.agentsmesh', 'agents'), { recursive: true });
  await mkdir(join(projectRoot, '.agentsmesh', 'commands'), { recursive: true });
  // Bare frontmatter — no `description`, no `tools`, no `model`,
  // no `allowed-tools`. Forces every `?? null` branch.
  await writeFile(
    join(projectRoot, '.agentsmesh', 'agents', 'bare.md'),
    '---\nname: bare\n---\n\nbody\n',
  );
  await writeFile(join(projectRoot, '.agentsmesh', 'commands', 'bare.md'), '---\n---\n\nbody\n');
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('canonical handler null fallbacks', () => {
  it('agents handler list summary returns null for missing description/tools/model', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    const list = await agentsHandlers.list(ctx);
    expect(list).toEqual([{ name: 'bare', description: null, tools: null, model: null }]);
  });

  it('commands handler list summary returns null for missing description/allowed-tools', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    const list = await commandsHandlers.list(ctx);
    expect(list).toEqual([{ name: 'bare', description: null, allowedTools: null }]);
  });
});
